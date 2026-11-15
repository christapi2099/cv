import { MAX_POINTS, VISUAL } from './config.js';
import { LightningEntity } from './entities/LightningEntity.js';
import { StormEntity } from './entities/StormEntity.js';
import { StreaksEntity } from './entities/StreaksEntity.js';
import { TunnelEntity } from './entities/TunnelEntity.js';

/**
 * Look strategies. A look is `{ name, supportsActors, createBackground(ctx) }`;
 * createBackground returns `{ entities, lightning }` (lightning may be null).
 * Switching looks disposes the old entities and creates new ones: no reload.
 *
 * ctx: { shared, tier, theme, palette, intensity, random }
 */
export const LOOKS = Object.freeze({
  storm: Object.freeze({
    name: 'storm',
    supportsActors: true,
    createBackground({ shared, tier, palette, intensity, random }) {
      const storm = new StormEntity({ shared, palette, tier, intensity });
      const lightning = new LightningEntity({ shared, palette, random });
      return { entities: [storm, lightning], lightning };
    },
  }),
  // v1 "Temporal Drift": exactly the v1 entities, shaders and behaviour.
  classic: Object.freeze({
    name: 'classic',
    supportsActors: false,
    createBackground({ shared, tier, theme, intensity }) {
      const common = { shared, theme, tier, intensity };
      return {
        entities: [
          new TunnelEntity(common),
          new StreaksEntity({ ...common, maxPoints: MAX_POINTS, range: VISUAL.streakDepth, near: VISUAL.streakNear }),
        ],
        lightning: null,
      };
    },
  }),
});
