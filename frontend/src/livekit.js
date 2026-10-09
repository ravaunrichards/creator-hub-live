 } catch (error) {
      if (window.console) {
        console.error(
          '[Creator Hub LIVE] Connection failed:',
          error
        );

        console.error(
          '[Creator Hub LIVE] Error code:',
          error && error.code
        );

        console.error(
          '[Creator Hub LIVE] Root cause:',
          error && error.cause
        );
      }

      CHL.disconnectLiveKit();

      var failure = createLiveKitError(
        error && error.message
          ? error.message
          : 'LiveKit connection failed. Check the browser console for details.',
        error && error.code
          ? error.code
          : 'LIVEKIT_CONNECTION_FAILED',
        error && error.cause
          ? error.cause
          : error
      );

      throw failure;
    }
