// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("./interop.cjs");
interop.r(exports), interop.d(exports, {
  TeamShowcase: () => b,
  TeamShowcaseReview: () => v,
  default: () => N
});
var t = require("react/jsx-runtime"),
  s = require("./dependencies/5772.cjs"),
  o = require("react"),
  n = require("./dependencies/25354.cjs"),
  r = require("./dependencies/18310.cjs"),
  l = require("./dependencies/80642.cjs"),
  d = require("./dependencies/31966.cjs"),
  c = require("./dependencies/90467.cjs"),
  h = require("./dependencies/66558.cjs"),
  m = require("./dependencies/73474.cjs"),
  p = require("./dependencies/67752.cjs"),
  g = require("./dependencies/7770.cjs"),
  u = require("./dependencies/37380.cjs"),
  y = interop.n(u);
let w = [{
    id: "emma",
    name: "Emma Collins",
    role: "Product designer",
    location: "Z\xfcrich, Switzerland",
    image: (0, p.o4)("emma-collins"),
    introduction: "Emma turns complex product decisions into calm, useful experiences. She cares about the first five minutes of a workflow and the details people notice much later.",
    focus: "Design systems and onboarding",
    email: "emma@arc.example",
    phone: "+1 (202) 555-0101"
  }, {
    id: "marcus",
    name: "Marcus Johnson",
    role: "Frontend engineer",
    location: "London, United Kingdom",
    image: (0, p.o4)("marcus-johnson"),
    introduction: "Marcus builds the foundations that let good ideas become dependable interfaces. He is happiest when a component feels simple to use and has room to grow.",
    focus: "Component architecture",
    email: "marcus@arc.example",
    phone: "+1 (202) 555-0102"
  }, {
    id: "ava",
    name: "Ava Mitchell",
    role: "Design lead",
    location: "Amsterdam, Netherlands",
    image: (0, p.o4)("ava-mitchell"),
    introduction: "Ava gives teams a shared point of view. She connects research, product direction, and the small decisions that make a service feel coherent.",
    focus: "Product direction",
    email: "ava@arc.example",
    phone: "+1 (202) 555-0103"
  }, {
    id: "jasmine",
    name: "Jasmine Brooks",
    role: "Platform engineer",
    location: "Berlin, Germany",
    image: (0, p.o4)("jasmine-brooks"),
    introduction: "Jasmine keeps the platform steady as the product finds its next shape. She works across performance, integrations, and the systems that should quietly keep working.",
    focus: "Platform and performance",
    email: "jasmine@arc.example",
    phone: "+1 (202) 555-0104"
  }, {
    id: "sofia",
    name: "Sofia Ramirez",
    role: "Operations partner",
    location: "New York, United States",
    image: (0, p.o4)("sofia-ramirez"),
    introduction: "Sofia makes space for focused work across a distributed team. She brings the right context together and helps a promising idea find its next practical step.",
    focus: "Team operations",
    email: "sofia@arc.example",
    phone: "+1 (202) 555-0105"
  }],
  _ = [{
    value: "gallery",
    label: "Gallery"
  }, {
    value: "filmstrip",
    label: "Filmstrip"
  }, {
    value: "directory",
    label: "Directory"
  }, {
    value: "spotlight",
    label: "Spotlight"
  }];
function j({
  person: e,
  sizes: a = "(max-width: 620px) 80vw, 30vw"
}) {
  return (0, t.jsx)(s.default, {
    src: e.image,
    alt: "",
    fill: !0,
    sizes: a
  });
}
function f({
  person: e
}) {
  if (!e.email && !e.phone) return null;
  return (0, t.jsx)("div", {
    className: y().contact,
    "aria-label": `Contact details for ${e.name}`,
    children: (0, t.jsxs)("div", {
      className: y().contactItems,
      children: [(0, t.jsxs)("span", {
        className: y().contactItem,
        children: [(0, t.jsx)("span", {
          children: e.email
        }), (0, t.jsx)(m.CopyButton, {
          value: e.email,
          label: `Copy ${e.name}'s email`,
          iconOnly: !0,
          variant: "plain"
        })]
      }), (0, t.jsxs)("span", {
        className: y().contactItem,
        children: [(0, t.jsx)("span", {
          children: e.phone
        }), (0, t.jsx)(m.CopyButton, {
          value: e.phone,
          label: `Copy ${e.name}'s phone number`,
          iconOnly: !0,
          variant: "plain"
        })]
      })]
    })
  });
}
function x({
  people: e,
  selectedIndex: a,
  reduce: i,
  offset: s = 8,
  className: o,
  itemClassName: r,
  render: l
}) {
  let d = {
    duration: g.T.duration.standard,
    ease: [...g.T.ease.standard]
  };
  return (0, t.jsx)("div", {
    className: [y().crossfade, o].filter(Boolean).join(" "),
    children: e.map((e, o) => {
      let c = o === a,
        h = i || c ? 0 : o < a ? -s : s;
      return (0, t.jsx)(n.PY1.div, {
        className: r,
        "data-active": c || void 0,
        "aria-hidden": !c,
        inert: !c,
        initial: !1,
        animate: {
          opacity: +!!c,
          x: 0,
          y: h
        },
        transition: i ? {
          duration: 0
        } : c ? d : {
          ...d,
          duration: g.T.duration.fast
        },
        children: l(e)
      }, e.id);
    })
  });
}
function b({
  variant: e = "gallery",
  onPersonSelect: a,
  people: i = w,
  title: s
}) {
  let h = (0, r.I)() ?? !1,
    m = (0, o.useId)(),
    p = (0, o.useRef)(null),
    u = (0, o.useRef)(null),
    [_, v] = (0, o.useState)(0),
    N = i[_],
    [k, C] = (0, o.useState)(!0),
    T = {
      duration: h ? 0 : g.T.duration.standard,
      ease: [...g.T.ease.enter]
    };
  function P(e) {
    let t = (e + i.length) % i.length;
    v(t);
    let s = p.current,
      o = s?.children[t];
    s && o && s.scrollWidth > s.clientWidth && s.scrollTo({
      left: o.offsetLeft - s.firstElementChild.offsetLeft,
      behavior: h ? "instant" : "smooth"
    });
    let n = u.current,
      r = n?.children[t];
    n && r && n.scrollWidth > n.clientWidth && n.scrollTo({
      left: r.offsetLeft - n.firstElementChild.offsetLeft,
      behavior: h ? "instant" : "smooth"
    }), a?.(i[t]);
  }
  let S = (0, t.jsx)(x, {
      people: i,
      selectedIndex: _,
      reduce: h,
      className: y().bioStack,
      itemClassName: y().bio,
      render: e => (0, t.jsxs)(t.Fragment, {
        children: [(0, t.jsxs)("div", {
          children: [(0, t.jsx)("h3", {
            children: e.name
          }), (0, t.jsx)("span", {
            children: e.role
          })]
        }), (0, t.jsx)("p", {
          children: e.introduction
        }), (0, t.jsx)("span", {
          className: y().location,
          children: e.location
        })]
      })
    }),
    A = (0, t.jsxs)("p", {
      className: y().srOnly,
      "aria-live": "polite",
      "aria-atomic": "true",
      children: [N.name, ", ", N.role]
    }),
    B = (0, t.jsxs)("div", {
      className: y().arrows,
      children: [(0, t.jsx)("button", {
        type: "button",
        onClick: () => P(_ - 1),
        "aria-label": "Show previous doctor",
        children: (0, t.jsx)(d.A, {
          size: 16,
          strokeWidth: 1.75,
          "aria-hidden": "true"
        })
      }), (0, t.jsxs)("span", {
        children: [_ + 1, " / ", i.length]
      }), (0, t.jsx)("button", {
        type: "button",
        onClick: () => P(_ + 1),
        "aria-label": "Show next doctor",
        children: (0, t.jsx)(c.A, {
          size: 16,
          strokeWidth: 1.75,
          "aria-hidden": "true"
        })
      })]
    });
  return (0, t.jsxs)("section", {
    className: `${y().showcase} ${y()[e]}`,
    "aria-labelledby": `${m}-title`,
    children: [(0, t.jsxs)(n.PY1.header, {
      className: y().header,
      initial: !h && {
        opacity: 0,
        y: 8
      },
      whileInView: {
        opacity: 1,
        y: 0
      },
      viewport: {
        once: !0,
        amount: .5
      },
      transition: {
        duration: h ? 0 : g.T.duration.considered,
        ease: [...g.T.ease.enter]
      },
      children: [(0, t.jsx)("h2", {
        id: `${m}-title`,
        children: s ?? ("directory" === e ? "The people behind Arc" : "Meet the team")
      }), "gallery" !== e && (0, t.jsx)("p", {
        children: "Five people across design, engineering, and operations."
      })]
    }), "gallery" === e && (0, t.jsxs)(t.Fragment, {
      children: [(0, t.jsx)("div", {
        className: y().galleryGrid,
        ref: u,
        children: i.map((e, a) => (0, t.jsxs)(n.PY1.button, {
          type: "button",
          initial: !h && {
            opacity: 0,
            y: 12
          },
          whileInView: {
            opacity: 1,
            y: 0
          },
          viewport: {
            once: !0,
            amount: .2
          },
          transition: {
            duration: h ? 0 : g.T.duration.considered,
            delay: h ? 0 : .05 * a,
            ease: [...g.T.ease.enter]
          },
          onFocus: e => {
            e.currentTarget.style.opacity = "1", e.currentTarget.style.transform = "none";
          },
          className: y().galleryPerson,
          onClick: () => P(a),
          "aria-pressed": _ === a,
          "aria-label": `Read about ${e.name}`,
          "aria-controls": `${m}-detail`,
          children: [(0, t.jsx)("span", {
            className: y().galleryPhoto,
            children: (0, t.jsx)(j, {
              person: e,
              sizes: "(max-width: 620px) 70vw, 20vw"
            })
          }), (0, t.jsx)("span", {
            className: y().personName,
            children: e.name
          }), (0, t.jsx)("span", {
            className: y().personRole,
            children: e.role
          })]
        }, e.id))
      }), (0, t.jsxs)("div", {
        id: `${m}-detail`,
        className: y().galleryDetail,
        children: [(0, t.jsx)(x, {
          people: i,
          selectedIndex: _,
          reduce: h,
          className: y().galleryBioStage,
          itemClassName: y().galleryBio,
          render: e => (0, t.jsxs)(t.Fragment, {
            children: [(0, t.jsxs)("div", {
              className: y().galleryBioIdentity,
              children: [(0, t.jsx)("h3", {
                children: e.name
              }), (0, t.jsxs)("span", {
                children: [e.role, " \xb7 ", e.location]
              })]
            }), (0, t.jsxs)("div", {
              className: y().galleryBioContent,
              children: [(0, t.jsx)("p", {
                children: e.introduction
              }), (0, t.jsx)(f, {
                person: e
              })]
            })]
          })
        }), (0, t.jsx)("div", {
          className: y().galleryNavigation,
          children: B
        }), A]
      })]
    }), "filmstrip" === e && (0, t.jsxs)(t.Fragment, {
      children: [(0, t.jsx)("div", {
        ref: p,
        className: y().filmTrack,
        children: i.map((e, a) => (0, t.jsxs)("button", {
          type: "button",
          className: y().filmPerson,
          "data-selected": _ === a,
          "aria-pressed": _ === a,
          "aria-label": `Read about ${e.name}`,
          "aria-controls": `${m}-detail`,
          onClick: () => P(a),
          children: [(0, t.jsx)(j, {
            person: e
          }), (0, t.jsx)("span", {
            className: y().filmName,
            children: e.name
          })]
        }, e.id))
      }), (0, t.jsxs)("div", {
        id: `${m}-detail`,
        className: y().filmDetail,
        children: [S, B, A]
      })]
    }), "directory" === e && (0, t.jsx)("div", {
      className: y().directoryList,
      children: i.map((e, a) => (0, t.jsxs)("div", {
        className: y().directoryPerson,
        "data-selected": _ === a,
        children: [(0, t.jsxs)("button", {
          type: "button",
          className: y().directoryTrigger,
          onClick: () => {
            C(a !== _ || !k), P(a);
          },
          "aria-expanded": _ === a && k,
          "aria-controls": `${m}-${e.id}`,
          children: [(0, t.jsx)("span", {
            className: y().directoryThumb,
            children: (0, t.jsx)(j, {
              person: e,
              sizes: "96px"
            })
          }), (0, t.jsx)("span", {
            className: y().directoryName,
            children: e.name
          }), (0, t.jsx)("span", {
            className: y().directoryRole,
            children: e.role
          }), (0, t.jsxs)("svg", {
            className: y().directoryIcon,
            "data-open": _ === a && k || void 0,
            width: "18",
            height: "18",
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 1.75,
            strokeLinecap: "round",
            "aria-hidden": "true",
            children: [(0, t.jsx)("path", {
              d: "M5 12h14"
            }), (0, t.jsx)("path", {
              className: y().directoryIconBar,
              d: "M12 5v14"
            })]
          })]
        }), (0, t.jsx)(l.N, {
          initial: !1,
          children: _ === a && k && (0, t.jsx)(n.PY1.div, {
            id: `${m}-${e.id}`,
            className: y().directoryPanel,
            initial: h ? {
              opacity: 0
            } : {
              height: 0,
              opacity: 0
            },
            animate: {
              height: "auto",
              opacity: 1
            },
            exit: h ? {
              opacity: 0,
              transition: {
                duration: 0
              }
            } : {
              height: 0,
              opacity: 0
            },
            transition: h ? {
              duration: 0
            } : {
              height: g.T.spring.smooth,
              opacity: {
                duration: g.T.duration.standard
              }
            },
            children: (0, t.jsxs)("div", {
              className: y().directoryExpanded,
              children: [(0, t.jsx)("div", {
                className: y().directoryPhoto,
                children: (0, t.jsx)(j, {
                  person: e
                })
              }), (0, t.jsxs)("div", {
                children: [(0, t.jsx)("p", {
                  children: e.introduction
                }), (0, t.jsxs)("dl", {
                  children: [(0, t.jsxs)("div", {
                    children: [(0, t.jsx)("dt", {
                      children: "Based in"
                    }), (0, t.jsx)("dd", {
                      children: e.location
                    })]
                  }), (0, t.jsxs)("div", {
                    children: [(0, t.jsx)("dt", {
                      children: "Working on"
                    }), (0, t.jsx)("dd", {
                      children: e.focus
                    })]
                  })]
                })]
              })]
            })
          }, "panel")
        })]
      }, e.id))
    }), "spotlight" === e && (0, t.jsxs)(t.Fragment, {
      children: [(0, t.jsxs)("div", {
        className: y().spotlightStage,
        children: [(0, t.jsxs)("div", {
          className: y().spotlightCopy,
          children: [S, B, A]
        }), (0, t.jsx)("div", {
          className: y().spotlightPhoto,
          children: i.map((e, a) => {
            let i = a === _;
            return (0, t.jsx)(n.PY1.div, {
              className: y().spotlightLayer,
              "aria-hidden": "true",
              style: {
                zIndex: +!!i
              },
              initial: !1,
              animate: {
                opacity: +!!i,
                x: i || h ? 0 : a < _ ? -12 : 12
              },
              transition: h ? {
                duration: 0
              } : i ? T : {
                duration: 0,
                delay: g.T.duration.standard
              },
              children: (0, t.jsx)(j, {
                person: e
              })
            }, e.id);
          })
        })]
      }), (0, t.jsx)("nav", {
        className: y().spotlightNav,
        "aria-label": "Choose a team member",
        children: i.map((e, a) => (0, t.jsxs)("button", {
          type: "button",
          onClick: () => P(a),
          "aria-pressed": _ === a,
          children: [(0, t.jsx)("span", {
            className: y().spotlightThumb,
            children: (0, t.jsx)(j, {
              person: e,
              sizes: "64px"
            })
          }), (0, t.jsx)("span", {
            children: e.name.split(" ")[0]
          })]
        }, e.id))
      })]
    })]
  });
}
function v() {
  let [e, a] = (0, o.useState)("gallery");
  return (0, t.jsxs)("div", {
    className: y().review,
    children: [(0, t.jsx)("div", {
      className: y().reviewControls,
      children: (0, t.jsx)(h.A, {
        label: "Team section design",
        options: _,
        value: e,
        onValueChange: e => a(e)
      })
    }), (0, t.jsx)(b, {
      variant: e
    }, e)]
  });
}
let N = b;
