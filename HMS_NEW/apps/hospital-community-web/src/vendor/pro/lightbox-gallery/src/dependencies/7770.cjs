// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  T: () => r
});
let r = {
  duration: {
    instant: .12,
    fast: .16,
    exit: .18,
    standard: .24,
    considered: .48
  },
  ease: {
    enter: [.16, 1, .3, 1],
    exit: [.7, 0, .84, 0],
    standard: [.22, 1, .36, 1],
    inOut: [.65, 0, .35, 1]
  },
  spring: {
    responsive: {
      type: "spring",
      stiffness: 520,
      damping: 38
    },
    gentle: {
      type: "spring",
      stiffness: 340,
      damping: 34
    },
    snappy: {
      type: "spring",
      visualDuration: .26,
      bounce: .12
    },
    smooth: {
      type: "spring",
      visualDuration: .4,
      bounce: 0
    },
    morph: {
      type: "spring",
      visualDuration: .42,
      bounce: .16
    }
  },
  stagger: {
    char: .016,
    word: .04,
    line: .08,
    item: .035
  },
  blur: {
    subtle: 2,
    soft: 4,
    text: 8
  }
};
