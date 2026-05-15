import type { AtlasFrame } from './textureTools';

export const NINJA_FRAMES = {
  idle: [
    { x: 24, y: 28, w: 90, h: 98 },
  ] satisfies AtlasFrame[],
  run: [
    { x: 22, y: 136, w: 88, h: 108 },
    { x: 112, y: 136, w: 88, h: 108 },
    { x: 204, y: 136, w: 88, h: 108 },
    { x: 296, y: 136, w: 88, h: 108 },
    { x: 390, y: 136, w: 88, h: 108 },
    { x: 486, y: 136, w: 88, h: 108 },
  ] satisfies AtlasFrame[],
  attack: [
    { x: 8, y: 760, w: 132, h: 200 },
    { x: 245, y: 790, w: 145, h: 170 },
    { x: 415, y: 778, w: 158, h: 180 },
    { x: 585, y: 780, w: 125, h: 180 },
  ] satisfies AtlasFrame[],
  ultimate: [
    { x: 842, y: 824, w: 188, h: 132 },
    { x: 1032, y: 824, w: 246, h: 132 },
    { x: 1288, y: 818, w: 190, h: 138 },
  ] satisfies AtlasFrame[],
};

export const ZOMBIE_FRAMES = {
  walkA: [
    { x: 232, y: 20, w: 70, h: 104 },
    { x: 296, y: 20, w: 72, h: 104 },
    { x: 364, y: 20, w: 70, h: 104 },
    { x: 432, y: 20, w: 58, h: 104 },
    { x: 492, y: 20, w: 74, h: 104 },
  ] satisfies AtlasFrame[],
  walkB: [
    { x: 232, y: 134, w: 70, h: 112 },
    { x: 296, y: 134, w: 72, h: 112 },
    { x: 364, y: 134, w: 70, h: 112 },
    { x: 432, y: 134, w: 58, h: 112 },
    { x: 492, y: 134, w: 74, h: 112 },
  ] satisfies AtlasFrame[],
  brute: [
    { x: 492, y: 340, w: 82, h: 140 },
    { x: 596, y: 340, w: 92, h: 140 },
  ] satisfies AtlasFrame[],
  dead: [
    { x: 1195, y: 20, w: 108, h: 86 },
    { x: 1312, y: 22, w: 104, h: 82 },
    { x: 1418, y: 22, w: 96, h: 82 },
    { x: 1194, y: 146, w: 110, h: 84 },
    { x: 1310, y: 146, w: 106, h: 82 },
  ] satisfies AtlasFrame[],
};

export const ENV_FRAMES = {
  tiles: [
    { x: 18, y: 18, w: 112, h: 112 },
    { x: 145, y: 18, w: 112, h: 112 },
    { x: 273, y: 18, w: 112, h: 112 },
    { x: 398, y: 18, w: 112, h: 112 },
    { x: 20, y: 136, w: 112, h: 112 },
    { x: 146, y: 136, w: 112, h: 112 },
    { x: 400, y: 136, w: 112, h: 112 },
  ] satisfies AtlasFrame[],
  lanterns: [
    { x: 513, y: 294, w: 72, h: 92 },
    { x: 598, y: 292, w: 70, h: 92 },
    { x: 680, y: 292, w: 70, h: 90 },
    { x: 765, y: 304, w: 42, h: 64 },
  ] satisfies AtlasFrame[],
  torii: [
    { x: 928, y: 254, w: 142, h: 150 },
    { x: 1100, y: 254, w: 156, h: 136 },
    { x: 1260, y: 264, w: 132, h: 106 },
  ] satisfies AtlasFrame[],
  bamboo: [
    { x: 520, y: 20, w: 130, h: 112 },
    { x: 672, y: 18, w: 134, h: 114 },
    { x: 830, y: 18, w: 122, h: 112 },
  ] satisfies AtlasFrame[],
  leaves: [
    { x: 688, y: 548, w: 104, h: 62 },
    { x: 812, y: 544, w: 86, h: 58 },
    { x: 704, y: 870, w: 186, h: 70 },
  ] satisfies AtlasFrame[],
  cracks: [
    { x: 1018, y: 640, w: 200, h: 130 },
    { x: 1230, y: 620, w: 260, h: 150 },
    { x: 30, y: 760, w: 200, h: 126 },
    { x: 252, y: 760, w: 178, h: 118 },
  ] satisfies AtlasFrame[],
};
