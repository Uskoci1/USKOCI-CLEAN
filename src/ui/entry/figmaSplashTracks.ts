// Values translated from the recorded Figma CSS snippets; see figma-motion.json.
export type Frame = { t: number; values: number[]; easing: string };
export type Tracks = Partial<Record<'opacity' | 'rotate' | 'translate' | 'scale', Frame[]>>;
export const SPLASH_DURATION_MS = 4500;
export const splashTracks: Record<string, Tracks> = {
  "15:490": {
    "opacity": [{"t":0,"values":[0],"easing":"ease-out"}, {"t":499.995,"values":[1],"easing":"linear"}, {"t":4500,"values":[1],"easing":"linear"}],
    "rotate": [{"t":0,"values":[0],"easing":"cubic-bezier(0.5, 0, 0.5, 1)"}, {"t":2357.505,"values":[0.007],"easing":"linear"}, {"t":4500,"values":[0.007],"easing":"linear"}],
    "translate": [{"t":0,"values":[0,0],"easing":"linear"}, {"t":2357.505,"values":[-3.044,26.921],"easing":"cubic-bezier(0.5, 0, 0.5, 1)"}, {"t":2500.02,"values":[0,0],"easing":"cubic-bezier(0.25, 1, 0.5, 1)"}, {"t":3799.98,"values":[-104.594,-120.5],"easing":"linear"}, {"t":4500,"values":[-104.594,-120.5],"easing":"linear"}],
    "scale": [{"t":0,"values":[1,1],"easing":"linear"}, {"t":2500.02,"values":[1,1],"easing":"cubic-bezier(0.25, 1, 0.5, 1)"}, {"t":3799.98,"values":[0.34,0.34],"easing":"linear"}, {"t":4500,"values":[0.34,0.34],"easing":"linear"}],
  },
  "15:491": {
    "opacity": [{"t":0,"values":[0],"easing":"linear"}, {"t":800.01,"values":[0],"easing":"cubic-bezier(0.16, 1, 0.3, 1)"}, {"t":1099.98,"values":[1],"easing":"linear"}, {"t":4500,"values":[1],"easing":"linear"}],
    "scale": [{"t":0,"values":[0.3,0.8],"easing":"linear"}, {"t":800.01,"values":[0.3,0.8],"easing":"cubic-bezier(0.16, 1, 0.3, 1)"}, {"t":1099.98,"values":[1,1],"easing":"linear"}, {"t":4500,"values":[1,1],"easing":"linear"}],
  },
  "15:493": {
    "opacity": [{"t":0,"values":[0],"easing":"linear"}, {"t":700.02,"values":[0],"easing":"cubic-bezier(0.16, 1, 0.3, 1)"}, {"t":999.99,"values":[1],"easing":"linear"}, {"t":4500,"values":[1],"easing":"linear"}],
    "rotate": [{"t":0,"values":[0.052],"easing":"linear"}, {"t":700.02,"values":[0.052],"easing":"cubic-bezier(0.16, 1, 0.3, 1)"}, {"t":1049.985,"values":[0],"easing":"linear"}, {"t":4500,"values":[0],"easing":"linear"}],
    "translate": [{"t":0,"values":[0,-45],"easing":"linear"}, {"t":700.02,"values":[0,-45],"easing":"cubic-bezier(0.16, 1, 0.3, 1)"}, {"t":1049.985,"values":[0,0],"easing":"linear"}, {"t":4500,"values":[0,0],"easing":"linear"}],
    "scale": [{"t":0,"values":[0.4,0.4],"easing":"linear"}, {"t":700.02,"values":[0.4,0.4],"easing":"cubic-bezier(0.16, 1, 0.3, 1)"}, {"t":1049.985,"values":[1,1],"easing":"linear"}, {"t":4500,"values":[1,1],"easing":"linear"}],
  },
  "15:495": {
    "opacity": [{"t":0,"values":[0],"easing":"cubic-bezier(0.22, 0.6, 0.36, 1)"}, {"t":450,"values":[1],"easing":"linear"}, {"t":4500,"values":[1],"easing":"linear"}],
    "rotate": [{"t":0,"values":[0.052],"easing":"cubic-bezier(0.22, 0.6, 0.36, 1)"}, {"t":599.985,"values":[0],"easing":"linear"}, {"t":1800,"values":[0],"easing":"cubic-bezier(0.16, 1, 0.3, 1)"}, {"t":1999.98,"values":[-0.061],"easing":"linear"}, {"t":2150.0099999999998,"values":[-0.061],"easing":"cubic-bezier(0.16, 1, 0.3, 1)"}, {"t":2349.9900000000002,"values":[0.017],"easing":"ease-in-out"}, {"t":2500.02,"values":[0],"easing":"linear"}, {"t":4500,"values":[0],"easing":"linear"}],
    "translate": [{"t":0,"values":[-35,0],"easing":"cubic-bezier(0.22, 0.6, 0.36, 1)"}, {"t":599.985,"values":[0,0],"easing":"linear"}, {"t":4500,"values":[0,0],"easing":"linear"}],
    "scale": [{"t":0,"values":[0.8,0.8],"easing":"cubic-bezier(0.25, 1, 0.5, 1)"}, {"t":599.985,"values":[1,1],"easing":"linear"}, {"t":1800,"values":[1,1],"easing":"cubic-bezier(0.25, 1, 0.5, 1)"}, {"t":1999.98,"values":[1.08,0.06],"easing":"linear"}, {"t":2150.0099999999998,"values":[1.08,0.06],"easing":"cubic-bezier(0.25, 1, 0.5, 1)"}, {"t":2349.9900000000002,"values":[0.96,1.12],"easing":"cubic-bezier(0.25, 1, 0.5, 1)"}, {"t":2500.02,"values":[1,1],"easing":"linear"}, {"t":4500,"values":[1,1],"easing":"linear"}],
  },
  "15:497": {
    "opacity": [{"t":0,"values":[0],"easing":"cubic-bezier(0.22, 0.6, 0.36, 1)"}, {"t":450,"values":[1],"easing":"linear"}, {"t":4500,"values":[1],"easing":"linear"}],
    "rotate": [{"t":0,"values":[-0.052],"easing":"cubic-bezier(0.22, 0.6, 0.36, 1)"}, {"t":599.985,"values":[0],"easing":"linear"}, {"t":4500,"values":[0],"easing":"linear"}],
    "translate": [{"t":0,"values":[35,0],"easing":"cubic-bezier(0.22, 0.6, 0.36, 1)"}, {"t":599.985,"values":[0,0],"easing":"linear"}, {"t":4500,"values":[0,0],"easing":"linear"}],
    "scale": [{"t":0,"values":[0.8,0.8],"easing":"cubic-bezier(0.22, 0.6, 0.36, 1)"}, {"t":599.985,"values":[1,1],"easing":"linear"}, {"t":4500,"values":[1,1],"easing":"linear"}],
  },
  "15:499": {
    "opacity": [{"t":0,"values":[0],"easing":"linear"}, {"t":599.985,"values":[0],"easing":"cubic-bezier(0.16, 1, 0.3, 1)"}, {"t":949.995,"values":[1],"easing":"linear"}, {"t":4500,"values":[1],"easing":"linear"}],
    "translate": [{"t":0,"values":[0,18],"easing":"linear"}, {"t":599.985,"values":[0,18],"easing":"cubic-bezier(0.16, 1, 0.3, 1)"}, {"t":949.995,"values":[0,0],"easing":"linear"}, {"t":4500,"values":[0,0],"easing":"linear"}],
    "scale": [{"t":0,"values":[0.75,0.75],"easing":"linear"}, {"t":599.985,"values":[0.75,0.75],"easing":"cubic-bezier(0.16, 1, 0.3, 1)"}, {"t":949.995,"values":[1,1],"easing":"linear"}, {"t":4500,"values":[1,1],"easing":"linear"}],
  },
  "15:501": {
    "opacity": [{"t":0,"values":[0],"easing":"cubic-bezier(0.22, 0.6, 0.36, 1)"}, {"t":499.995,"values":[1],"easing":"linear"}, {"t":4500,"values":[1],"easing":"linear"}],
    "rotate": [{"t":0,"values":[0.052],"easing":"cubic-bezier(0.22, 0.6, 0.36, 1)"}, {"t":700.02,"values":[0],"easing":"linear"}, {"t":4500,"values":[0],"easing":"linear"}],
    "translate": [{"t":0,"values":[-40,0],"easing":"cubic-bezier(0.22, 0.6, 0.36, 1)"}, {"t":700.02,"values":[0,0],"easing":"linear"}, {"t":4500,"values":[0,0],"easing":"linear"}],
    "scale": [{"t":0,"values":[0.85,0.85],"easing":"cubic-bezier(0.22, 0.6, 0.36, 1)"}, {"t":700.02,"values":[1,1],"easing":"linear"}, {"t":4500,"values":[1,1],"easing":"linear"}],
  },
  "15:503": {
    "opacity": [{"t":0,"values":[0],"easing":"cubic-bezier(0.22, 0.6, 0.36, 1)"}, {"t":499.995,"values":[1],"easing":"linear"}, {"t":4500,"values":[1],"easing":"linear"}],
    "rotate": [{"t":0,"values":[-0.052],"easing":"cubic-bezier(0.22, 0.6, 0.36, 1)"}, {"t":700.02,"values":[0],"easing":"linear"}, {"t":4500,"values":[0],"easing":"linear"}],
    "translate": [{"t":0,"values":[40,0],"easing":"cubic-bezier(0.22, 0.6, 0.36, 1)"}, {"t":700.02,"values":[0,0],"easing":"linear"}, {"t":4500,"values":[0,0],"easing":"linear"}],
    "scale": [{"t":0,"values":[0.85,0.85],"easing":"cubic-bezier(0.22, 0.6, 0.36, 1)"}, {"t":700.02,"values":[1,1],"easing":"linear"}, {"t":4500,"values":[1,1],"easing":"linear"}],
  },
  "15:506": {
    "opacity": [{"t":0,"values":[0],"easing":"linear"}, {"t":3100.0049999999997,"values":[0],"easing":"cubic-bezier(0.25, 1, 0.5, 1)"}, {"t":4000.0049999999997,"values":[1],"easing":"linear"}, {"t":4500,"values":[1],"easing":"linear"}],
    "translate": [{"t":0,"values":[-25,0],"easing":"linear"}, {"t":3100.0049999999997,"values":[-25,0],"easing":"cubic-bezier(0.25, 1, 0.5, 1)"}, {"t":4000.0049999999997,"values":[0,0],"easing":"linear"}, {"t":4500,"values":[0,0],"easing":"linear"}],
  },
  "15:507": {
    "opacity": [{"t":0,"values":[0],"easing":"linear"}, {"t":3199.9950000000003,"values":[0],"easing":"cubic-bezier(0.25, 1, 0.5, 1)"}, {"t":4099.995,"values":[1],"easing":"linear"}, {"t":4500,"values":[1],"easing":"linear"}],
    "translate": [{"t":0,"values":[-20,0],"easing":"linear"}, {"t":3199.9950000000003,"values":[-20,0],"easing":"cubic-bezier(0.25, 1, 0.5, 1)"}, {"t":4099.995,"values":[0,0],"easing":"linear"}, {"t":4500,"values":[0,0],"easing":"linear"}],
  },
  "15:508": {
    "opacity": [{"t":0,"values":[0],"easing":"linear"}, {"t":3299.985,"values":[0],"easing":"cubic-bezier(0.25, 1, 0.5, 1)"}, {"t":4149.99,"values":[1],"easing":"linear"}, {"t":4500,"values":[1],"easing":"linear"}],
    "translate": [{"t":0,"values":[-15,0],"easing":"linear"}, {"t":3299.985,"values":[-15,0],"easing":"cubic-bezier(0.25, 1, 0.5, 1)"}, {"t":4149.99,"values":[0,0],"easing":"linear"}, {"t":4500,"values":[0,0],"easing":"linear"}],
  },
  "15:509": {
    "opacity": [{"t":0,"values":[0],"easing":"linear"}, {"t":3400.02,"values":[0],"easing":"cubic-bezier(0.25, 1, 0.5, 1)"}, {"t":4199.985,"values":[1],"easing":"linear"}, {"t":4500,"values":[1],"easing":"linear"}],
    "scale": [{"t":0,"values":[0.3,0.3],"easing":"linear"}, {"t":3400.02,"values":[0.3,0.3],"easing":"cubic-bezier(0.25, 1, 0.5, 1)"}, {"t":4199.985,"values":[1,1],"easing":"linear"}, {"t":4500,"values":[1,1],"easing":"linear"}],
  },
};
