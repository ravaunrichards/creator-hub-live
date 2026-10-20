/* Creator Hub Live â€” LiveKit browser integration.
 * Browser receives only short-lived participant tokens.
 * LiveKit private API credentials never enter browser code.
 */
(function () {
  'use strict';

  var CHL = window.CHL;
  if (!CHL) {
    throw new Error('Creator Hub core is required before livekit.js.');
  }

  var activeRoom = null;
  var activeMediaMode = 'video';
  var handlers = [];
  var unloading = false;

  function eventName(name, fallback) {
    var events =
      window.LivekitClient &&
      window.LivekitClient.RoomEvent;

    return (events && events[name]) || fallback || name;
  }

  function bind(room, name, fn) {
    if (!room || typeof room.on !== 'function') return;

    var resolved = eventName(name);

    room.on(resolved, fn);
    handlers.push([room, resolved, fn]);
  }

  function clearHandlers() {
    handlers.forEach(function (handler) {
      try {
        if (handler[0] && typeof handler[0].off === 'function') {
          handler[0].off(handler[1], handler[2]);
        }
      } catch (_) {}
    });

    handlers = [];
  }

  function ensureSdk() {
    if (
      !window.LivekitClient ||
      !window.LivekitClient.Room
    ) {
      var error = new Error(
        'LiveKit browser SDK is unavailable.'
      );

      error.code = 'LIVEKIT_SDK_UNAVAILABLE';
      throw error;
    }
  }

  function normalizeRoomName(options) {
    options = options || {};

    var roomName =
      options.roomName ||
      options.livekitRoomName ||
      '';

    /*
     * roomId is accepted only as a compatibility fallback.
     *
     * IMPORTANT:
     * roomId and roomName are not conceptually the same thing.
     *
     * Creator Hub database:
     *   roomId = database LIVE-session identifier
     *
     * LiveKit:
     *   roomName = LiveKit room name
     */
    if (!roomName && options.roomId) {
      roomName = options.roomId;
    }

    return String(roomName || '').trim();
  }

  function getTrackType(track) {
    if (!track) return '';

    try {
      if (
        window.LivekitClient &&
        window.LivekitClient.Track &&
        window.LivekitClient.Track.Source
      ) {
        var source = track.source;

        if (
          source === window.LivekitClient.Track.Source.Camera ||
          source === 'camera'
        ) {
          return 'camera';
        }

        if (
          source === window.LivekitClient.Track.Source.Microphone ||
          source === 'microphone'
        ) {
          return 'microphone';
        }

        if (
          source === window.LivekitClient.Track.Source.ScreenShare ||
          source === 'screen_share'
        ) {
          return 'screen';
        }
      }
    } catch (_) {}

    var kind = String(track.kind || '').toLowerCase();

    if (
      kind === 'video' ||
      kind === 'videotrack'
    ) {
      return 'video';
    }

    if (
      kind === 'audio' ||
      kind === 'audiotrack'
    ) {
      return 'audio';
    }

    return '';
  }

  function safeStopTrack(track) {
    try {
      if (track && typeof track.stop === 'function') {
        track.stop();
      }
    } catch (_) {}
  }

  function detachTrack(track) {
    try {
      if (
        track &&
        typeof track.detach === 'function'
      ) {
        var elements = track.detach();

        if (elements && elements.forEach) {
          elements.forEach(function (element) {
            try {
              element.remove();
            } catch (_) {}
          });
        }
      }
    } catch (_) {}
  }

  function stopLocalTracks(room) {
    if (!room || !room.localParticipant) return;

    try {
      var publications =
        room.localParticipant.trackPublications;

      if (!publications) return;

      publications.forEach(function (publication) {
        try {
          if (publication && publication.track) {
            detachTrack(publication.track);
            safeStopTrack(publication.track);
          }
        } catch (_) {}
      });
    } catch (_) {}
  }

  function createLiveKitError(message, code, cause) {
    var error = new Error(
      message ||
      'LiveKit connection failed.'
    );

    error.code =
      code ||
      'LIVEKIT_CONNECTION_FAILED';

    if (cause) {
      error.cause = cause;
    }

    return error;
  }

  /*
   * Connect to an existing LiveKit room.
   *
   * The backend remains responsible for:
   * - authentication
   * - authorization
   * - token creation
   * - deciding whether this participant may publish
   *
   * The browser never receives private LiveKit credentials.
   */
  CHL.connectLiveKit = async function (options) {
    options = options || {};

    ensureSdk();

    if (!CHL.user) {
      throw createLiveKitError(
        'Please sign in before connecting to LIVE.',
        'AUTH_REQUIRED'
      );
    }

    var roomName = normalizeRoomName(options);

    if (!roomName) {
      throw createLiveKitError(
        'A valid LIVE room name is required.',
        'INVALID_ROOM'
      );
    }

    if (activeRoom) {
      CHL.disconnectLiveKit();
    }

    var canPublish =
      options.canPublish === true;
    activeMediaMode = ['video', 'audio', 'screen'].indexOf(String(options.mediaMode || 'video')) >= 0
      ? String(options.mediaMode || 'video')
      : 'video';

    var ttlSeconds =
      Number(options.ttlSeconds || 3600);

    if (!Number.isFinite(ttlSeconds)) {
      ttlSeconds = 3600;
    }

    ttlSeconds = Math.max(
      60,
      Math.min(3600, ttlSeconds)
    );

    var tokenData;

    try {
      /*
       * IMPORTANT:
       * The backend endpoint expects roomName.
       *
       * We intentionally do NOT send:
       *     { roomId: roomName }
       *
       * We send:
       *     { roomName, canPublish, ttlSeconds }
       */
      tokenData =
        await CHL.getLiveKitToken(
          roomName,
          canPublish,
          ttlSeconds
        );
    } catch (error) {
      if (error) {
        error.code =
          error.code ||
          'TOKEN_GENERATION_FAILED';
      }

      throw error;
    }

    if (
      !tokenData ||
      !tokenData.token ||
      !tokenData.serverUrl
    ) {
      throw createLiveKitError(
        'The backend returned an incomplete LiveKit connection response.',
        'TOKEN_GENERATION_FAILED'
      );
    }

    var Room =
      window.LivekitClient.Room;

    var room;

    try {
      room = new Room({
        adaptiveStream: true,
        dynacast: true
      });
    } catch (error) {
      throw createLiveKitError(
        'Unable to create the LiveKit room connection.',
        'LIVEKIT_ROOM_CREATION_FAILED',
        error
      );
    }

    activeRoom = room;

    /*
     * Remote media
     */
    bind(
      room,
      'TrackSubscribed',
      function (
        track,
        publication,
        participant
      ) {
        try {
          if (options.onRemoteTrack) {
            options.onRemoteTrack(
              track,
              participant,
              publication
            );
          }
        } catch (error) {
          if (window.console) {
            console.error(
              '[Creator Hub] Remote track handler failed.',
              error
            );
          }
        }
      }
    );

    bind(
      room,
      'DataReceived',
      function (payload, participant, kind, topic) {
        try {
          if (options.onDataReceived) options.onDataReceived(payload, participant, kind, topic);
        } catch (error) {
          if (window.console) console.warn('[Creator Hub] Live data handler failed.', error);
        }
      }
    );

    bind(
      room,
      'TrackUnsubscribed',
      function (
        track,
        publication,
        participant
      ) {
        try {
          detachTrack(track);

          if (
            options.onRemoteTrackRemoved
          ) {
            options.onRemoteTrackRemoved(
              track,
              participant,
              publication
            );
          }
        } catch (error) {
          if (window.console) {
            console.error(
              '[Creator Hub] Remote track removal handler failed.',
              error
            );
          }
        }
      }
    );

    /*
     * Participants
     */
    bind(
      room,
      'ParticipantConnected',
      function (participant) {
        try {
          if (
            options.onParticipantConnected
          ) {
            options.onParticipantConnected(
              participant
            );
          }
        } catch (_) {}
      }
    );

    bind(
      room,
      'ParticipantPermissionsChanged',
      function (previousPermissions, participant) {
        try {
          var changedParticipant = participant && participant.identity ? participant : (previousPermissions && previousPermissions.identity ? previousPermissions : null);
          if (changedParticipant && options.onParticipantPermissionsChanged) options.onParticipantPermissionsChanged(changedParticipant, previousPermissions);
        } catch (error) {
          if (window.console) console.warn('[Creator Hub] Participant permission handler failed.', error);
        }
      }
    );

    bind(
      room,
      'ParticipantDisconnected',
      function (participant) {
        try {
          if (
            options.onParticipantDisconnected
          ) {
            options.onParticipantDisconnected(
              participant
            );
          }
        } catch (_) {}
      }
    );

    /*
     * Speakers
     */
    bind(
      room,
      'ActiveSpeakersChanged',
      function (speakers) {
        try {
          if (options.onActiveSpeakers) {
            options.onActiveSpeakers(
              speakers || []
            );
          }
        } catch (_) {}
      }
    );

    /*
     * Connection lifecycle
     */
    bind(
      room,
      'Reconnecting',
      function () {
        try {
          if (options.onReconnecting) {
            options.onReconnecting();
          }
        } catch (_) {}
      }
    );

    bind(
      room,
      'Reconnected',
      function () {
        try {
          if (options.onReconnected) {
            options.onReconnected();
          }
        } catch (_) {}
      }
    );

    bind(
      room,
      'Disconnected',
      function (reason) {
        try {
          if (options.onDisconnected) {
            options.onDisconnected(
              reason
            );
          }
        } catch (_) {}

        /*
         * Do not automatically clear activeRoom here.
         * disconnectLiveKit() owns complete cleanup.
         */
      }
    );

    bind(
      room,
      'ConnectionStateChanged',
      function (state) {
        try {
          if (
            options.onConnectionState
          ) {
            options.onConnectionState(
              state
            );
          }
        } catch (_) {}
      }
    );

    try {
      /*
       * LiveKit connection:
       *
       * serverUrl:
       *     public LiveKit WebSocket URL
       *
       * token:
       *     short-lived participant token
       *
       * The API key and API secret never enter this browser call.
       */
      await room.connect(
        tokenData.serverUrl,
        tokenData.token,
        {
          autoSubscribe: true
        }
      );

      /*
       * Only report connection success here.
       *
       * IMPORTANT:
       * Being connected to LiveKit does NOT automatically mean
       * Creator Hub should mark the session LIVE.
       *
       * Host publication must be completed and verified by the
       * backend before the LIVE database state is changed.
       */
      if (options.onConnected) {
        await options.onConnected(
          room,
          tokenData
        );
      }

      return {
        room: room,
        roomName: roomName,
        tokenData: tokenData,
        canPublish: !!tokenData.canPublish
      };
    } catch (error) {
      CHL.disconnectLiveKit();

      throw createLiveKitError(
        error &&
          error.message
          ? error.message
          : 'LiveKit connection failed.',
        'LIVEKIT_CONNECTION_FAILED',
        error
      );
    }
  };

  /*
   * Disconnect and completely clean up the local LiveKit session.
   */
  CHL.disconnectLiveKit = function () {
    var room = activeRoom;

    activeRoom = null;
    activeMediaMode = 'video';

    clearHandlers();

    if (!room) {
      return;
    }

    try {
      stopLocalTracks(room);
    } catch (_) {}

    try {
      if (
        room.localParticipant &&
        room.localParticipant.trackPublications
      ) {
        room.localParticipant.trackPublications.forEach(
          function (publication) {
            try {
              if (
                publication &&
                publication.track
              ) {
                detachTrack(
                  publication.track
                );
              }
            } catch (_) {}
          }
        );
      }
    } catch (_) {}

    try {
      room.disconnect();
    } catch (_) {}
  };

  /*
   * Camera
   */
  CHL.publishCamera = async function () {
    if (activeMediaMode !== 'video') {
      var modeError = new Error('Camera publishing is only available in Video LIVE.');
      modeError.code = 'MEDIA_MODE_RESTRICTED';
      throw modeError;
    }
    if (!activeRoom) {
      var error = new Error(
        'Not connected to LIVE.'
      );

      error.code =
        'LIVEKIT_NOT_CONNECTED';

      throw error;
    }

    try {
      return await activeRoom.localParticipant
        .setCameraEnabled(true);
    } catch (error) {
      error.code =
        error.code ||
        'MEDIA_PERMISSION_DENIED';

      error.mediaType = 'camera';

      throw error;
    }
  };

  CHL.unpublishCamera = async function () {
    if (!activeRoom) return false;

    return activeRoom.localParticipant
      .setCameraEnabled(false);
  };

  /*
   * Microphone
   */
  CHL.publishMicrophone = async function () {
    if (activeMediaMode === 'screen') {
      var modeError = new Error('Microphone publishing is disabled in Screen-Sharing LIVE.');
      modeError.code = 'MEDIA_MODE_RESTRICTED';
      throw modeError;
    }
    if (!activeRoom) {
      var error = new Error(
        'Not connected to LIVE.'
      );

      error.code =
        'LIVEKIT_NOT_CONNECTED';

      throw error;
    }

    try {
      return await activeRoom.localParticipant
        .setMicrophoneEnabled(true);
    } catch (error) {
      error.code =
        error.code ||
        'MEDIA_PERMISSION_DENIED';

      error.mediaType = 'microphone';

      throw error;
    }
  };

  CHL.unpublishMicrophone = async function () {
    if (!activeRoom) return false;

    return activeRoom.localParticipant
      .setMicrophoneEnabled(false);
  };

  /*
   * Camera toggle
   */
  CHL.toggleCamera = async function () {
    if (activeMediaMode !== 'video') {
      var modeError = new Error('Camera controls are only available in Video LIVE.');
      modeError.code = 'MEDIA_MODE_RESTRICTED';
      throw modeError;
    }
    if (!activeRoom) {
      var error = new Error(
        'Not connected to LIVE.'
      );

      error.code =
        'LIVEKIT_NOT_CONNECTED';

      throw error;
    }

    var participant =
      activeRoom.localParticipant;

    var enabled =
      !!participant.isCameraEnabled;

    return participant.setCameraEnabled(
      !enabled
    );
  };

  /*
   * Microphone toggle
   */
  CHL.toggleMicrophone = async function () {
    if (activeMediaMode === 'screen') {
      var modeError = new Error('Microphone controls are disabled in Screen-Sharing LIVE.');
      modeError.code = 'MEDIA_MODE_RESTRICTED';
      throw modeError;
    }
    if (!activeRoom) {
      var error = new Error(
        'Not connected to LIVE.'
      );

      error.code =
        'LIVEKIT_NOT_CONNECTED';

      throw error;
    }

    var participant =
      activeRoom.localParticipant;

    var enabled =
      !!participant.isMicrophoneEnabled;

    return participant.setMicrophoneEnabled(
      !enabled
    );
  };

  /*
   * Screen sharing
   */
  CHL.startScreenShare = async function () {
    if (activeMediaMode !== 'screen' && activeMediaMode !== 'video') {
      var modeError = new Error('Screen sharing is unavailable in Audio-only LIVE.');
      modeError.code = 'MEDIA_MODE_RESTRICTED';
      ¼ÚXW×ÌLnî&Õ²+3Š›‰a È`1ı%¶!‰ÆE%eÚw[wd#RØJ2<åøhgd8 iˆkTc$ùªfO6\ÿäl*8+0`”a!3Zl¨W}~?µæ,e$³t•³g3o/kpba Ï¦`Ò+9ŞPÿR.z%H%nµ, Ä¡­ôD¤s=_ÉVGÇHwNLEUµ^Î)C\ÑÔ…‰Aø î.[4àŠr†`¤%“Å.
»kf) e`PŒ5ín ˜ÒeX¹~ 2fDBdai3'¨ÖCXYØlbH`ÙØ½xB," YZ¦`íU^)î/àDÅmDQhmdÉ('ıœ{hµÕkßõdùk(¬­Ìj€‡d¤-N'Ù^AuùÿO0,ˆ$Ù
bÀ 6-za68·¬qljpER*dÆ7%£ëõtcVò×³q
Tº98xöÀ‚§vaìöÁHêA}ö10[y$>BX/'HTKwuHnä2}¯Dä)÷ˆ 2méY3Z
<©Àt10b©;:P¦¥:$0c@ÁTLbBñ±`¾Ub
`0%.€aˆ   '[(N äÂÛHaÙmw5İS^	Sÿ5f†'k¸ş.3¼t€ùK¶é3u[tqäwow\ßBq„¡ Ä¡d
@9èy°ı,¦†¾(â£2µp:PP‹okõ¡a!ğiiS"msïe"b§B`säJa-aWÔ:,b!À½… êD3ØÃj34GrRiJ±1aòêt¦ib%Àhà0¸‚hª§ãº-?M ¨)@py2-Ã¸.#!¹°pÁ"à)¡†gœ`¨ôxõUªè ‡¨ÃÉT*}C â9,bJ„‚64’ukF"h' jòö nª¨JE­Ò—knP{¬ ‹±(h|èCà4¡â!"[Ä½æ1 ì™?d`€¡x°{ÔÇ7fnBÜ„^WX´A`ZEnƒŠx"	*´RàipPOæà}h%z½ê$ ( ûI  u­+È[¢ÈF¯c´ïT{J{VWÊÀ2m!"AG}vó¢Cf7<Jîƒ)!)»„!TÑ¹~#ÆÃ$btxĞ*‰o[z Fxo;§,ìëmn# và ¼SÑ²(½ìNö§sînhlgsÅd&ê,}Â@àd2!¤` )í(;;ætÀ1ãfì\œ[QúDdb>,gnÿ%% j`i5
e½»*>. )® I'*xpOedia ågx`1a^1-¢hCOå$¥òÑº$šb	  jè|6µ<wGgaJ*q(AdgutÏx»‚ staèG/€ $Hbôte„Ëšb}ò'‡îv±acuW4qÎi%Y >2âSf@'en )0ŒØl@.'ºÆ;>^ivD Œ!/À) Y¨Cq^>o±fyì	»ª4õøUX¡°,™öu´[oq$02´F@(düw-ı]µ£4Úd#ïO&õYóÉKªº!14äÆ
Ü¤ìa-dşå|$êR¤Ø¨°($aë‹d(÷[|ïñstÏô¯ÏBUç*çµ7=ˆè³'i)$¨ñíF@0A¨IJjGy¯å,¨ d@UM¬ jjà V`2·‡Sï0uM¢“Ò``åì`IOiaîÆRŠ A,J1-*¥$G|EqEÎJê z:9¦% ¬›‹X `8)ï (`J.<sd0à3ìoqèÅş´ (+ı¢Q%
hhÈ]' {),ÿ:0–pŸd°©‘èvgWv+ÿ3>W®¡é`û?  :¥ ñ +òfnz&İ¤}oÛf1*™B*°ó‡6¢+IcpxÑUˆÆèN~cØlMÄ_ØîliÔ${ó4­$#“bÃr¤ë/> 04ê980 Ãbıâµh*  cì#,Šd<m,´H‰!h,²Dy[±w$,nş!"¨7u»! s‚'\ @&i}|ùN<6ÅLg¶ës9†YÑ½pÂĞ3ij,ƒ>0ë´Utƒ€êÉø"`(3ï¸eAnEò
°/¹ cH  ëqyï±iõğzå{¡ııQYo¥!! c;dÛ($	p¦éeØñ^ &õSf¾Ê0zàõY2´CV;}Ï`h%ô g¿ÓZ|æ6Åu?&l-n äZaË2•Gj†{¼¬1>*`)å†)Ê6àzu$åFÁVp^8ëTeĞàc) lVgWiTeoY×ån•;$í=¤EäŠ)h p`a9%4%¬V¢ïtâŒ„[weIOìäú¹õ»PXh(§²0(ÍfîÒÏû*u3'!bõff¡øÙt"",Ïãw1cu0%Q#WNôKQ-" ’p(;¡ +(Òm‹*áe Ate1|2F!hqdıîd«Á*0ù%_:C}q9d ¨.`rnö9:ÿjp’ƒ€öùˆé´¹ıO…®22&. îÚeº]ALF*‘àâ<óD®
gÈÁÜf¸˜kb8	ù&;6ÊÌ«dûKTe@Ü¯X @uâ‹•*»zıÑ`µ=‰IŠØK*Xb¯)‹ïvåğœòIQs¹Í,J˜°<K,H@`"¡»>k /¦pè>2#$p¿cÈ!.`8¢ÿÊùbh 42¥yñL~5d /c#l,8½ŒƒatŠ6EB' *&gs*o]_U2#jlm+£Ldnİ2mç8]a,èzñipoPÈÄâpm	Ò5}eE*Ä«bº-ë’CŒìlc´f3@âIÄ"+¹”¦[.ódig* IZ 'jdñK@ À9
ÙB%ó±(d¨2á€¤\j¡3ëjöò $j©9˜x`î«

  ®&b@h`ú¡RÆOSA~õ#äˆËKü©Ş}2ÌJ~qYymÒ#ï.}'` 0¾ ¿efıúÂf"¤éG¦Õ{(¥ÆüpzE÷e\ß|¤¯i0ÖAæõy(¡ãg‡é`¢E¬@1;:mus&Z¤
(!7!°!‚étTwıfÎ|C¶ŸfirUSqucg*O'ˆ/¨rµoc¸5ÎtR `•q€(¬š²r!êwôl²Çãû:e·n™A+ €u;D
äaë«J, ç´“r|aü4`%kôy	b°%êCïkzGû @eãğ TxÙƒ&`·²H’¢N1±Ï-MKù\+bÉ|À)ks{Îcï’ ´M/@Ã¯ˆ:¿rd½¾-Jd~CÍl«Cé’Ñ` Ÿà’à!gy{úúÅø$ Üë 0l'p$FÜ!L"£|mOõrê®da":"è<H¡#‹¢6}!åÑ¤xÆutmq²Ğ¬#I _ J@ ƒ1ğªù.{*ÂÁáº€“)árhÀ0‘d¦£¤:¯*°P0Bd‚ZcèvÍ€M›M)Õeq8uz`ê(U*5J"Ô]läìÊ²*¼!l!93õAqX¦üÀ.aòŠIm3o%ÜF !â(¢), /FhE	[Ähsozl*, ı¨‡ "l–`* wQfŒïå£0áæ&Š¥èNƒ 8)'kŒ0x
/«%]JàGvÁ%$^(§íka$ª±z`x¦^ pUo0v|jd7°¥p±5F9(dš !e¸Še€ìnhá¦eünu¡meôE×¯ìÔsÈE3$MÉÓ]/ğ `{‚CÉª°4*So`®·¸Fe€v
QYÇàÃm¤ D[aüvmp,nóVS´f#3º*–0+	d-ù-e$edy
g(AS¥dy©`m*ÓwSìg&¬ IédQqtp¤,élvÄ-¤iãÅ'rSR3İu+Úü$l‚:Y6QRî7u.g'uDÙCz-¡``lôàhfñ¥IaJß>
"e›MtA}¯1ã1q´Tù)bY0.¬êQ(6ùÒ#v=*úç€øg@(oeEiädÁYÅ|7§oé?U^ƒùjp¬#¢LˆÕulÚ GDxjn;6`ñå¯£¹gw:¤%ÿ~(9G;E$GkfIs=­VK@VUXdòUÉNiÜ9ÁM]?=Î- !ÙŠ"p(6ÉI¬+pCSím`€ü"ÀeñıVatb8Hÿ*	°¹¹<Ù ş­``yH¨oóåîrfi}d8ß˜Ãq´¡éÆ,ha­Q»dmş=Xg4 1/Btôy(!'s9iËçÀ°|Acİ —’uÀlHeaT‘[¤äURu|hâvOm¤l¹,òÎ*eQj2c°@U|f:÷i¬a²ªŒ¬š_Ê
÷J$Ã~LŠDeİFJTY&(;zğñ<mMë2 6Êú üå(‘l ¨
´À%r{!b~jQªAUq 1Dşum$üH…xG®;ıù}æ:.Í#j©på©zê%—Ôb`'1y0p b.u««íá%!ù)ßšŠ,- wÀG; A3á4Ùp	ts”tònãee usödM5:1Né\É¢f%Oo!è¡iDAFE,çOîÍfäâaëôáolmF/Ad `Ã<ŠfBı‚Ff #üh‹]VA]GAÔhGF¦ªàQ‰o_j]„Á¤D4AÿgÛ-"g@Váb6!¸_O@êU³ö.'qVdhUNg|¬Ñ6Š±±qh5%qOKQn/$93á5eéy$“c™ßzgìL¨'DjèiDÔvJFc/ËÛ±T¡D}¡ĞàWnÿŒ86!$& Æ<÷Ü÷CcË\İD=UI;g¿n_àÑRËÙ³™"«´&)3w!éô/D3pdá?fG!h óïKöt)È=k<'âã<0›1@Ğğa¨Dìkw¢èö0Y¥(íyPuôŠƒ%sU}kEéÛ
x($¢‚íeP'Äx]e7êÌm>ûŒC³?r¾à$8/ Tµ:£,NfÈ(qØic2§ÀiôV
£A(q4q	 h¦oxmbO"!¦qŒ¢i@U`hâù¥Ôah9©áGÅam§zÁF'¢,H>
 :_¨lïH5Ps!©òbÓdÃ½¤_!8Ş¦gƒmfõüktc>- -%Ób%«•ùD 	v+…àI—:ê+«Lÿ}d¤”õsf^(d]¸1›B&k ,&Ãwæ9q  0A:pë¥/vcâ–4!cOùñ9|1Hg2`Ìr°7%`3h(4"y†ğHåDª"ûNLâ±îIA2CQuå®vL,!Lài¥š8j®C!©oc cÔu¢%%ƒ'é.bSBz¡l-8¥Vqêh6MÕÚJv5oæt}e*N `c¢.èÄ LwÂ^«yñĞSû¤¼w5:Y$5f/,` á¤pá.lÕ¬úııªC4ğ±	t=B$Qù}Ì Ÿ,ğ@¸`Ty,¤à ke0 !€i¤0¾áq¡0´àt´á* nqÄCºˆlŠ.Üa(!ãÃlbz¥(V#1KyQó |øÌ'¾ÂQqnzÄà›JA!$(-…½8^ ¬Ê P0Àâ ²r Ky|
ğÙš÷L¤É<#Y´"$+h‚ h¥Ä l~U7Wr4D`€|%2à<4ÁF$ €Ø÷ †5¡"ÏØc -+¬:}pÑ/Hà¡ò(” (`2U)5E'¢$+nv&3-0ôK 'x `qä
	° ')è(") bÊh2°dP`8ı<fi#àÁ'NA5ı"|ß‹i +Àµrw¡£p¡P”`!Dq©µ }|w—%ZlìfNB8©`$# Ğå`"$ÂsJâ@9x$g00
®&)†’R”mq?L;¾HuWäEÖ°3AÂ!/Zr 4¡/?'@B…5 Ra´`Qu.ÿ.P¼1ap]H@Á6Á)°p¨œ«ï8Q°º(¨ğòu Ûo völs3c­‰:àãæVznm}áî`ˆ_-ÄËé)xÈ. kYnèÛJ .I¨R >«!!(*€ª8B¡‰&Rê‹´ãn"f) +À]ÇpLæíKÜ*4¿L$ @ç&úEO<aq,(OÇ`<ß¡!"+?$İÎ2Ks#¤fo$,hYh\D ®1PÊ %«ÏÙ/ëá41ÿ?èâƒFµ5Ô9Lc[ıtLüN!]rWbio8½¢œd¤}*É!i3Ì d¯®$ĞC $½ÀÈ¨%$ÃX!g5İ¯O¹LläöAjÑo~Fe»ëH@§‚aKáØè'k,*èA`è-_à'%G°q}ta!³&dÎ‘ÀB(%¤aöo}Í5^(%#Ç%q¬c0Ûc+Òc:öÀ./h@—”,#T´¥qØCJÈõ!kbit olb§œ&$(¡~€$ty¶k»p‚!G1Vh8X&
 ¶2&   Hru!lÈ@î´hÛ©ñ!'úGsnc¨&h §)²¯Hpc|wâL»~!
Py$~èÉ…–i]v1Fƒj!8X8×¡$$hÛvp Shx'3h1¢,qd­=s~LÈûn˜)-+K1qà…(¥µ p`À N×ygoo~Œxqóëî9`¥‚ïëœ$¤&%`*ª4´¤–¤è.±šÃ¦å´"-âŠ4@!=>İ¼¨„ ( ©­>‘¡&j0f 04®lckÜ];Âb! Êa Á` 
a‚VÓ  jR|à«ñAæË]V·L¡1{ÚÂ¡@Â–$ `‚FÒ` 2ˆ™Bñä#Ğ$Xğ°²8èùbp­Î ñ )`pa¡ÊŞ’Æê A0”oi$5=8õéiâĞqiûàd€z|°;sÒcƒğn 0*Bb *|qp¤:5?mGqu†$ÿg.âÂ a  :,(Pëz†x5à¤Ä$€ÑØ0)2lW
¸¨Tá~zu—9j¹` , z0e#_}ú©®ô ‡2-?P AyÉ0 –&(D$âaCPêø" XEæ``sŸƒ(,` |'^hzb®Zw¹]ìåpŒ!i` i } #½07I(4w54êH‚ù¦!N btoúB-Eã‰M‚9lX32øû8,(ª~°=,¾€"~¿ğDï
vå~Éí®G²ô`bõ_ïapñg ïì/¦tu>5&ï®<iÃ>ô2ìyC•¤Di´ècpàÎ“TìUÁ Å´°%( tmÈ%`ªttöB#Œ6c|U™¤zKĞÃm`u€¿(kKchig¤Àtå~%zn*şaém ï ,¤¥l	¢µáÒÂg«i2È"!¦Å²àx›U)¡» ¡ra\I-ËhaFF.=í¥†ÁOƒşë9$0 ¤4(4"¡Z"1AC>a``PLca&éÃeNõ¬t's=' (+·¥  (!gdùbwi,7¾¤À$K†Â p O8¹‚@ÎˆT;fRÔ<E†2L!Á\Kcy|$åkb¦B-/‡”¨'!(è¥ 0  Z`jôdsX†.u-zëìf…¦£)"0¯Š `£paBÌF]àeú4Wt,Í§ 0	­`R„ °!]P Nà, !z_ú¦-²ák_!óñİ|4‹Q&7
`h
?i"›ˆ KY,¾d_æ8¼uæ§tc£¼¶×aqÌëw”½ğ'> ")¢u6_¢©f.,8iJfô5°bdĞ´úgœ-TĞQÔ*ºdI‹  a0ğ° ä§æCa#¶ÆŠ>Jpùx=sh$ i@)¡"a`p jfq£¨Únof@öe+!BªaàJa`sã'éÑaál¥Šh$õ}4íåy4p$> Ö/9É„@;5ozôÈ¨gMÌ‰[%İfï(?yCi"WJ)4b58ï,'r»lqEª¹Nº,¡°y$Šj¦rïÍevİ;Qy)êIqá• 4 Ì$QÈ‹¾0ïtjH$¡”p²6°N7"Ğ™2ñaç=yAbt£nä]$³ü{G¨`¡í©$1>hôÌfF`i­šv,(­)y-Àu3”Apa ° ar›62'e})£ñ¤b&c-D©ij³ F<¢°l€*L`®h,ş¯Š!@ÄI9G‰w%ævñmÏv2 lcpp€u óşAôÎo.(ıhôF?r?½ù{tB `b±ô&3d$nPh5CH˜sn Â&aEc°µJiN""qÔG#+Dî Jğnfü?tÑCå¼0Ğ4aH67¬èjm³Œ¿$<|E=ú hDÚ¡èyd:LcîƒrT FeÛ6(`1\#êBáoK3ôR3º"jhêsë¥çeÿÜ®i%@ m`JkŞdqö•ÙñIhqa¤É°"!7"#A\O{viw(ğ1* p8‡KIÜ/óYJeo~õcß\söŸrG\2:‹<$®Š„A;(rS}weCz AÈ}8ñutÜa|OS'y<.`İ<˜MŠT„‘yÌàu™à%…HG1^%Êm“+İïqğ "P¨°HgÂF4à0æ|)l¦`&¼#À ¡âvQú~ËR%(é°2)è oW}Pif9Ã4u5:
Kc¤†ík[ls&J àVà}…KØmÄ¿«kzBtAô väß»°,Ê;Ë8G°`2ÆÏåaõuë'¼jŸaËª5ß§O8¥uÊ*À5' ?¯›ÕBğ{~jåa` z‰W9†{å;²GJ÷Zw“!E„fı¤bvwÖ?t¿ñŸ[BdXF
Àë0/3}/u+(uàa¤Œ"ö¾a»ï"ïuãPlôxEZgïH;s?Æ'¥#¥bn,Šè/V6‹’¨`*BQaNdmM®9Â­»wULZ°éAã›±-Ø›¨H t¥ÎUkwÖ§ß ` §6Tioâ\=ïXa5ÂdŒ@ 'ƒ-Éò¼¨: (0 $ `/fïvT­fcWw#²4J 08„ ,„¤aNçyÖNUîÿ "(¢I,'ª0
å¯6QdÆÜ,;'))¤¡ ´¤ÍVdsÃGvÆë5ófÌyÃîév<!y	ğ  ! öÍİ,yh|wJÀ‰L10»xJ+H¦ª}‹à	WîHj{¯Šn2.í…HÄ©s$_5 Ò!	0İ+N1ù3Ş