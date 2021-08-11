import { CLIPPING_THRESHOLD_ENABLED, CLIPPING_THRESHOLD_DEFAULT } from "../react-components/preferences-screen";
import { updateAudioSettings } from "../update-audio-settings";

function isClippingEnabled() {
  const { enableAudioClipping } = window.APP.store.state.preferences;
  return enableAudioClipping !== undefined ? enableAudioClipping : CLIPPING_THRESHOLD_ENABLED;
}

function getClippingThreshold() {
  const { audioClippingThreshold } = window.APP.store.state.preferences;
  return audioClippingThreshold !== undefined ? audioClippingThreshold : CLIPPING_THRESHOLD_DEFAULT;
}

const distanceModels = {
  linear: function(distance, rolloffFactor, refDistance, maxDistance) {
    return 1.0 - rolloffFactor * ((distance - refDistance) / (maxDistance - refDistance));
  },
  inverse: function(distance, rolloffFactor, refDistance) {
    return refDistance / (refDistance + rolloffFactor * (Math.max(distance, refDistance) - refDistance));
  },
  exponential: function(distance, rolloffFactor, refDistance) {
    return Math.pow(Math.max(distance, refDistance) / refDistance, -rolloffFactor);
  }
};

const updateAttenuation = (() => {
  const listenerPos = new THREE.Vector3();
  const sourcePos = new THREE.Vector3();
  return source => {
    source.el.sceneEl.audioListener.getWorldPosition(listenerPos);
    source.audioRef.getWorldPosition(sourcePos);
    const distance = sourcePos.distanceTo(listenerPos);
    if (source.audioRef.panner) {
      return distanceModels[source.audioRef.panner.distanceModel](
        distance,
        source.audioRef.panner.rolloffFactor,
        source.audioRef.panner.refDistance,
        source.audioRef.panner.maxDistance
      );
    } else {
      return 1.0;
    }
  };
})();

export class GainSystem {
  constructor() {
    this.sources = [];
  }

  remove() {
    this.sources = [];
  }

  registerSource(source) {
    this.sources.push(source);
  }

  unregisterSource(source) {
    const index = this.sources.indexOf(source);

    if (index !== -1) {
      this.sources.splice(index, 1);
    }
  }

  tick() {
    const clippingEnabled = isClippingEnabled();
    const clippingThreshold = getClippingThreshold();
    this.sources.forEach(source => {
      const isClipped = APP.clippingState.has(source.el);
      if (source.audioRef && clippingEnabled) {
        const att = updateAttenuation(source);
        if (att < clippingThreshold) {
          if (!isClipped) {
            APP.clippingState.add(source.el);
            updateAudioSettings(source.el, source.audioRef);
          }
        } else if (isClipped) {
          APP.clippingState.delete(source.el);
          updateAudioSettings(source.el, source.audioRef);
        }
      } else if (isClipped) {
        APP.clippingState.delete(source.el);
        updateAudioSettings(source.el, source.audioRef);
      }
    });
  }
}
