            : 'WAITING FOR HOST';
      }

      /*
       * Establish real-time connection options.
       * We leverage the CHL layer completed earlier to abstract core events.
       */
      var connection = await CHL.connectLiveKit({
        roomName: room.room_name || room.id,
        canPublish: isHost,
        
        // Fired whenever a remote participant publishes a track (Viewers see Host, Host sees Co-Hosts)
        onRemoteTrack: function (track, participant, publication) {
          if (track.kind === 'video' || track.kind === 'audio') {
            CHL.attachRemoteTrack(track, stage);
            
            // If the host is streaming, flip the subscriber banner immediately
            if (String(participant.identity) === String(roomHostId) && track.kind === 'video') {
              status.textContent = 'LIVE';
              status.style.background = 'rgba(180, 0, 40, 0.85)';
            }
          }
        },

        // Cleanly strips deleted or unsubscribed media tracks away from the DOM tree
        onRemoteTrackRemoved: function (track, participant, publication) {
          CHL.detachTrack(track);
          
          // Revert state if the host cuts their camera
          if (String(participant.identity) === String(roomHostId) && track.kind === 'video') {
            status.textContent = 'HOST DISCONNECTED';
            status.style.background = 'rgba(0, 0, 0, 0.7)';
          }
        },

        // Triggered after successful handshake with the LiveKit infrastructure
        onConnected: async function (activeRoom, tokenData) {
          CHL.toast('Connected to secure media stream server.');

          if (isHost) {
            status.textContent = 'STARTING BROADCAST…';
            
            try {
              // 1. Force enable local hardware capturing modules immediately
              await CHL.publishCamera();
              await CHL.publishMicrophone();
              
              // 2. Proactively mount the host's local track locally for validation feedback
              activeRoom.localParticipant.trackPublications.forEach(function (pub) {
                if (pub.track && (pub.track.kind === 'video' || pub.track.kind === 'camera')) {
                  CHL.attachLocalTrack(pub.track, stage);
                }
              });

              // 3. Inform the server authoritative verification gate to finalize DB status state updates
              var verification = await CHL.authenticatedApiRequest('/api/livekit/verify-live', {
                method: 'POST',
                body: JSON.stringify({ roomName: room.room_name || room.id })
              });

              if (verification && verification.verified) {
                liveStarted = true;
                status.textContent = 'LIVE';
                status.style.background = 'rgba(180, 0, 40, 0.85)';
                CHL.toast('Your broadcast is live to the network!');
              }
            } catch (mediaError) {
              console.error('[LIVEKIT UI ERROR]', mediaError);
              CHL.toast('Broadcast initialization failed: ' + (mediaError.message || 'Media rejected.'));
              status.textContent = 'HARDWARE ERROR';
            }
          }
        },

        onDisconnected: function (reason) {
          status.textContent = 'OFFLINE';
          status.style.background = 'rgba(100, 100, 100, 0.7)';
          CHL.toast('Disconnected from session: ' + reason);
        }
      });

    } catch (apiError) {
      console.error('[LIVE ROUTE CRASH]', apiError);
      outlet.innerHTML = ''; // Clean outlet footprint
      outlet.appendChild(
        ui.empty(
          '❌',
          'Connection Failed',
          apiError.message || 'Unable to register room connection pipelines.'
        )
      );
    }
  });

  // ============================================================================
  // Chat & Functional Action Helpers
  // ============================================================================

  async function sendChatMessage(roomId, inputElement, messageContainer) {
    var text = String(inputElement.value || '').trim();
    if (!text) return;

    try {
      // Use LiveKit's DataPacket pipeline or falling back to custom platform HTTP proxies
      var activeRoom = CHL.getActiveLiveKitRoom();
      if (activeRoom && CHL.isLiveKitConnected()) {
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify({ type: 'chat', text: text, user: CHL.user.name }));
        
        // Broadcast chat text payload reliably to all interconnected peers
        await activeRoom.localParticipant.publishData(data, { reliable: true });
      }

      // Render locally inside the viewport layout context safely
      var msgEl = el('div', { style: 'margin-bottom:4px; font-size:13px;' }, [
        el('strong', { text: (CHL.user.name || 'You') + ': ' }),
        el('span', { text: text })
      ]);
      
      messageContainer.appendChild(msgEl);
      messageContainer.scrollTop = messageContainer.scrollHeight;
      inputElement.value = '';
    } catch (e) {
      CHL.toast('Message delivery failed.');
    }
  }

  async function sendGift(roomId, gift) {
    try {
      var activeRoom = CHL.getActiveLiveKitRoom();
      if (!activeRoom || !CHL.isLiveKitConnected()) {
        throw new Error('Must be connected to stream to transmit tipping rewards.');
      }

      // Process direct ledger balance mutations via backend gateway prior to visual animations
      var transaction = await CHL.authenticatedApiRequest('/api/wallet/gift', {
        method: 'POST',
        body: JSON.stringify({ roomId: roomId, giftKey: gift.k })
      });

      if (transaction && transaction.success) {
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify({ type: 'gift', gift: gift, user: CHL.user.name }));
        await activeRoom.localParticipant.publishData(data, { reliable: true });
        
        CHL.toast('Sent ' + gift.k + ' ' + gift.em + ' successfully!');
      }
    } catch (err) {
      CHL.toast(err.message || 'Insufficient coin wallet funds.');
    }
  }

  async function endLive(roomId) {
    if (!confirm('Are you sure you want to terminate this broadcast session permanently?')) return;
    
    try {
      await CHL.authenticatedApiRequest('/api/live/rooms/' + encodeURIComponent(roomId) + '/terminate', {
        method: 'POST'
      });
      
      CHL.disconnectLiveKit();
      CHL.navigate('#/dashboard');
    } catch (e) {
      CHL.toast('Unable to cleanly terminate session.');
    }
  }

})();
