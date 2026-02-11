import React, { useEffect, useState, useRef, useCallback, useMemo, forwardRef } from 'react';
import { motion, useAnimation, useMotionValue } from 'framer-motion';
import { 
  ShieldHalf, 
  Ghost, 
  Shuffle, 
  CloudOff, 
  Server, 
  Skull, 
  ShieldAlert, 
  Eye, 
  Dna, 
  FlaskConical, 
  Zap, 
  Brain, 
  WifiOff, 
  Layers, 
  Github, 
  Linkedin, 
  Twitter,
  ChevronRight,
  Plus,
  CheckCircle2,
  Loader2,
  Send
} from 'lucide-react';

/* --- Utility to load GSAP & ScrollTrigger dynamically --- */
const useGsap = () => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (window.gsap && window.ScrollTrigger) {
      setLoaded(true);
      return;
    }
    
    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });
    };

    Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js'),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js')
    ]).then(() => {
      if (window.gsap && window.ScrollTrigger) {
        window.gsap.registerPlugin(window.ScrollTrigger);
        setLoaded(true);
      }
    }).catch(err => console.error("Failed to load GSAP", err));
    
  }, []);
  return loaded;
};

/* --- Utility to load Three.js dynamically (Replacement for OGL) --- */
const useThree = () => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (window.THREE) {
      setLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    script.async = true;
    script.onload = () => setLoaded(true);
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);
  return loaded;
};

/* --- Particles Component (Adapted to Three.js) --- */
const defaultColors = ['#ffffff', '#ffffff', '#ffffff'];

const hexToRgb = hex => {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map(c => c + c)
      .join('');
  }
  const int = parseInt(hex, 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  return [r, g, b];
};

const vertexShader = `
  attribute vec4 random;
  attribute vec3 color;
  
  uniform float uTime;
  uniform float uSpread;
  uniform float uBaseSize;
  uniform float uSizeRandomness;
  
  varying vec4 vRandom;
  varying vec3 vColor;
  
  void main() {
    vRandom = random;
    vColor = color;
    
    vec3 pos = position * uSpread;
    pos.z *= 10.0;
    
    vec4 mPos = modelMatrix * vec4(pos, 1.0);
    float t = uTime;
    mPos.x += sin(t * random.z + 6.28 * random.w) * mix(0.1, 1.5, random.x);
    mPos.y += sin(t * random.y + 6.28 * random.x) * mix(0.1, 1.5, random.w);
    mPos.z += sin(t * random.w + 6.28 * random.y) * mix(0.1, 1.5, random.z);
    
    vec4 mvPos = viewMatrix * mPos;

    if (uSizeRandomness == 0.0) {
      gl_PointSize = uBaseSize;
    } else {
      gl_PointSize = (uBaseSize * (1.0 + uSizeRandomness * (random.x - 0.5))) / length(mvPos.xyz);
    }

    gl_Position = projectionMatrix * mvPos;
  }
`;

const fragmentShader = `
  precision highp float;
  
  uniform float uTime;
  uniform float uAlphaParticles;
  varying vec4 vRandom;
  varying vec3 vColor;
  
  void main() {
    vec2 uv = gl_PointCoord.xy;
    float d = length(uv - vec2(0.5));
    
    if(uAlphaParticles < 0.5) {
      if(d > 0.5) {
        discard;
      }
      gl_FragColor = vec4(vColor + 0.2 * sin(uv.yxx + uTime + vRandom.y * 6.28), 1.0);
    } else {
      float circle = smoothstep(0.5, 0.4, d) * 0.8;
      gl_FragColor = vec4(vColor + 0.2 * sin(uv.yxx + uTime + vRandom.y * 6.28), circle);
    }
  }
`;

const Particles = ({
  particleCount = 200,
  particleSpread = 10,
  speed = 0.1,
  particleColors,
  moveParticlesOnHover = false,
  particleHoverFactor = 1,
  alphaParticles = false,
  particleBaseSize = 100,
  sizeRandomness = 1,
  cameraDistance = 20,
  disableRotation = false,
  pixelRatio = 1,
  className = ''
}) => {
  const containerRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const threeLoaded = useThree();

  useEffect(() => {
    if (!threeLoaded || !containerRef.current) return;
    const THREE = window.THREE;

    const container = containerRef.current;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(15, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = cameraDistance;

    // Geometry
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const randoms = new Float32Array(particleCount * 4);
    const colors = new Float32Array(particleCount * 3);
    const palette = particleColors && particleColors.length > 0 ? particleColors : defaultColors;

    for (let i = 0; i < particleCount; i++) {
      let x, y, z, len;
      do {
        x = Math.random() * 2 - 1;
        y = Math.random() * 2 - 1;
        z = Math.random() * 2 - 1;
        len = x * x + y * y + z * z;
      } while (len > 1 || len === 0);
      const r = Math.cbrt(Math.random());
      
      positions[i * 3] = x * r;
      positions[i * 3 + 1] = y * r;
      positions[i * 3 + 2] = z * r;

      randoms[i * 4] = Math.random();
      randoms[i * 4 + 1] = Math.random();
      randoms[i * 4 + 2] = Math.random();
      randoms[i * 4 + 3] = Math.random();

      const col = hexToRgb(palette[Math.floor(Math.random() * palette.length)]);
      colors[i * 3] = col[0];
      colors[i * 3 + 1] = col[1];
      colors[i * 3 + 2] = col[2];
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('random', new THREE.BufferAttribute(randoms, 4));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Material
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSpread: { value: particleSpread },
        uBaseSize: { value: particleBaseSize * pixelRatio },
        uSizeRandomness: { value: sizeRandomness },
        uAlphaParticles: { value: alphaParticles ? 1.0 : 0.0 }
      },
      transparent: true,
      depthTest: false
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Handlers
    const resize = () => {
        if (!container) return;
        const width = container.clientWidth;
        const height = container.clientHeight;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', resize);

    const handleMouseMove = e => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mouseRef.current = { x, y };
    };

    if (moveParticlesOnHover) {
        window.addEventListener('mousemove', handleMouseMove);
    }

    // Loop
    let animationFrameId;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      material.uniforms.uTime.value = elapsed * speed;

      if (moveParticlesOnHover) {
        particles.position.x = -mouseRef.current.x * particleHoverFactor;
        particles.position.y = -mouseRef.current.y * particleHoverFactor;
      }

      if (!disableRotation) {
        particles.rotation.x = Math.sin(elapsed * 0.2) * 0.1;
        particles.rotation.y = Math.cos(elapsed * 0.5) * 0.15;
        particles.rotation.z += 0.01 * speed;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
    };
  }, [threeLoaded, particleCount, particleSpread, speed, particleColors, moveParticlesOnHover, particleHoverFactor, alphaParticles, particleBaseSize, sizeRandomness, cameraDistance, disableRotation, pixelRatio]);

  return <div ref={containerRef} className={`particles-container ${className}`} />;
};

/* --- Variable Proximity Hooks & Component --- */
function useAnimationFrame(callback) {
  useEffect(() => {
    let frameId;
    const loop = () => {
      callback();
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [callback]);
}

function useMousePositionRef(containerRef) {
  const positionRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const updatePosition = (x, y) => {
      if (containerRef?.current) {
        const rect = containerRef.current.getBoundingClientRect();
        positionRef.current = { x: x - rect.left, y: y - rect.top };
      } else {
        positionRef.current = { x, y };
      }
    };

    const handleMouseMove = ev => updatePosition(ev.clientX, ev.clientY);
    const handleTouchMove = ev => {
      const touch = ev.touches[0];
      updatePosition(touch.clientX, touch.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [containerRef]);

  return positionRef;
}

const VariableProximity = forwardRef((props, ref) => {
  const {
    label,
    fromFontVariationSettings,
    toFontVariationSettings,
    containerRef,
    radius = 50,
    falloff = 'linear',
    className = '',
    onClick,
    style,
    ...restProps
  } = props;

  const letterRefs = useRef([]);
  const interpolatedSettingsRef = useRef([]);
  const mousePositionRef = useMousePositionRef(containerRef);
  const lastPositionRef = useRef({ x: null, y: null });

  const parsedSettings = useMemo(() => {
    const parseSettings = settingsStr =>
      new Map(
        settingsStr
          .split(',')
          .map(s => s.trim())
          .map(s => {
            const [name, value] = s.split(' ');
            return [name.replace(/['"]/g, ''), parseFloat(value)];
          })
      );

    const fromSettings = parseSettings(fromFontVariationSettings);
    const toSettings = parseSettings(toFontVariationSettings);

    return Array.from(fromSettings.entries()).map(([axis, fromValue]) => ({
      axis,
      fromValue,
      toValue: toSettings.get(axis) ?? fromValue
    }));
  }, [fromFontVariationSettings, toFontVariationSettings]);

  const calculateDistance = (x1, y1, x2, y2) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

  const calculateFalloff = distance => {
    const norm = Math.min(Math.max(1 - distance / radius, 0), 1);
    switch (falloff) {
      case 'exponential':
        return norm ** 2;
      case 'gaussian':
        return Math.exp(-((distance / (radius / 2)) ** 2) / 2);
      case 'linear':
      default:
        return norm;
    }
  };

  useAnimationFrame(() => {
    const { x: mouseX, y: mouseY } = mousePositionRef.current;

    if (lastPositionRef.current.x === mouseX && lastPositionRef.current.y === mouseY) {
      // return; 
    }
    lastPositionRef.current = { x: mouseX, y: mouseY };

    letterRefs.current.forEach((letterRef, index) => {
      if (!letterRef) return;

      const rect = letterRef.getBoundingClientRect();
      let letterCenterX = rect.left + rect.width / 2;
      let letterCenterY = rect.top + rect.height / 2;

      if (containerRef?.current) {
          const containerRect = containerRef.current.getBoundingClientRect();
          letterCenterX -= containerRect.left;
          letterCenterY -= containerRect.top;
      }

      const distance = calculateDistance(
        mouseX,
        mouseY,
        letterCenterX,
        letterCenterY
      );

      if (distance >= radius) {
        letterRef.style.fontVariationSettings = fromFontVariationSettings;
        return;
      }

      const falloffValue = calculateFalloff(distance);
      const newSettings = parsedSettings
        .map(({ axis, fromValue, toValue }) => {
          const interpolatedValue = fromValue + (toValue - fromValue) * falloffValue;
          return `'${axis}' ${interpolatedValue}`;
        })
        .join(', ');

      interpolatedSettingsRef.current[index] = newSettings;
      letterRef.style.fontVariationSettings = newSettings;
    });
  });

  const words = label.split(' ');
  let letterIndex = 0;

  return (
    <span
      ref={ref}
      className={`${className} variable-proximity`}
      onClick={onClick}
      style={{ display: 'inline', ...style }}
      {...restProps}
    >
      {words.map((word, wordIndex) => (
        <span key={wordIndex} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
          {word.split('').map(letter => {
            const currentLetterIndex = letterIndex++;
            return (
              <motion.span
                key={currentLetterIndex}
                ref={el => {
                  letterRefs.current[currentLetterIndex] = el;
                }}
                style={{
                  display: 'inline-block',
                  fontVariationSettings: interpolatedSettingsRef.current[currentLetterIndex]
                }}
                aria-hidden="true"
              >
                {letter}
              </motion.span>
            );
          })}
          {wordIndex < words.length - 1 && <span style={{ display: 'inline-block' }}>&nbsp;</span>}
        </span>
      ))}
      <span className="sr-only">{label}</span>
    </span>
  );
});
VariableProximity.displayName = 'VariableProximity';

/* --- SpotlightCard Component --- */
const SpotlightCard = ({ children, className = '', spotlightColor = 'rgba(255, 255, 255, 0.25)' }) => {
  const divRef = useRef(null);

  const handleMouseMove = e => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    divRef.current.style.setProperty('--mouse-x', `${x}px`);
    divRef.current.style.setProperty('--mouse-y', `${y}px`);
    divRef.current.style.setProperty('--spotlight-color', spotlightColor);
  };

  return (
    <div ref={divRef} onMouseMove={handleMouseMove} className={`card-spotlight ${className}`}>
      {children}
    </div>
  );
};

/* --- ScrollReveal Component --- */
const ScrollReveal = ({
  children,
  scrollContainerRef,
  enableBlur = true,
  baseOpacity = 0.1,
  baseRotation = 3,
  blurStrength = 4,
  containerClassName = '',
  textClassName = '',
  rotationEnd = 'bottom bottom',
  wordAnimationEnd = 'bottom bottom'
}) => {
  const containerRef = useRef(null);
  const gsapLoaded = useGsap();

  const splitText = useMemo(() => {
    const text = typeof children === 'string' ? children : '';
    return text.split(/(\s+)/).map((word, index) => {
      if (word.match(/^\s+$/)) return word;
      return (
        <span className="word" key={index} style={{ display: 'inline-block' }}>
          {word}
        </span>
      );
    });
  }, [children]);

  useEffect(() => {
    if (!gsapLoaded || !window.gsap || !window.ScrollTrigger) return;
    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;

    const el = containerRef.current;
    if (!el) return;

    const scroller = scrollContainerRef && scrollContainerRef.current ? scrollContainerRef.current : window;

    gsap.fromTo(
      el,
      { transformOrigin: '0% 50%', rotate: baseRotation },
      {
        ease: 'none',
        rotate: 0,
        scrollTrigger: {
          trigger: el,
          scroller,
          start: 'top bottom',
          end: rotationEnd,
          scrub: true
        }
      }
    );

    const wordElements = el.querySelectorAll('.word');

    gsap.fromTo(
      wordElements,
      { opacity: baseOpacity, willChange: 'opacity' },
      {
        ease: 'none',
        opacity: 1,
        stagger: 0.05,
        scrollTrigger: {
          trigger: el,
          scroller,
          start: 'top bottom-=20%',
          end: wordAnimationEnd,
          scrub: true
        }
      }
    );

    if (enableBlur) {
      gsap.fromTo(
        wordElements,
        { filter: `blur(${blurStrength}px)` },
        {
          ease: 'none',
          filter: 'blur(0px)',
          stagger: 0.05,
          scrollTrigger: {
            trigger: el,
            scroller,
            start: 'top bottom-=20%',
            end: wordAnimationEnd,
            scrub: true
          }
        }
      );
    }

    return () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, [scrollContainerRef, enableBlur, baseRotation, baseOpacity, rotationEnd, wordAnimationEnd, blurStrength, gsapLoaded]);

  return (
    <h2 ref={containerRef} className={`scroll-reveal ${containerClassName}`}>
      <p className={`scroll-reveal-text ${textClassName}`}>{splitText}</p>
    </h2>
  );
};

/* --- PillNav Component --- */
const PillNav = ({
  logo,
  logoAlt = 'Logo',
  items,
  activeHref,
  className = '',
  ease = 'power3.easeOut',
  baseColor = '#fff',
  pillColor = '#060010',
  hoveredPillTextColor = '#060010',
  pillTextColor,
  onMobileMenuClick,
  initialLoadAnimation = true
}) => {
  const gsapReady = useGsap();
  const resolvedPillTextColor = pillTextColor ?? baseColor;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const circleRefs = useRef([]);
  const tlRefs = useRef([]);
  const activeTweenRefs = useRef([]);
  const logoImgRef = useRef(null);
  const logoTweenRef = useRef(null);
  const hamburgerRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const navItemsRef = useRef(null);
  const logoRef = useRef(null);

  const handleLinkClick = (e, href) => {
    e.preventDefault();
    const targetId = href.replace('#', '');
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    } else if (href === '#') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (isMobileMenuOpen) toggleMobileMenu();
  };

  useEffect(() => {
    if (!gsapReady || !window.gsap) return;
    const gsap = window.gsap;

    const layout = () => {
      circleRefs.current.forEach(circle => {
        if (!circle?.parentElement) return;

        const pill = circle.parentElement;
        const rect = pill.getBoundingClientRect();
        const { width: w, height: h } = rect;
        const R = ((w * w) / 4 + h * h) / (2 * h);
        const D = Math.ceil(2 * R) + 2;
        const delta = Math.ceil(R - Math.sqrt(Math.max(0, R * R - (w * w) / 4))) + 1;
        const originY = D - delta;

        circle.style.width = `${D}px`;
        circle.style.height = `${D}px`;
        circle.style.bottom = `-${delta}px`;

        gsap.set(circle, {
          xPercent: -50,
          scale: 0,
          transformOrigin: `50% ${originY}px`
        });

        const label = pill.querySelector('.pill-label');
        const white = pill.querySelector('.pill-label-hover');

        if (label) gsap.set(label, { y: 0 });
        if (white) gsap.set(white, { y: h + 12, opacity: 0 });

        const index = circleRefs.current.indexOf(circle);
        if (index === -1) return;

        tlRefs.current[index]?.kill();
        const tl = gsap.timeline({ paused: true });

        tl.to(circle, { scale: 1.2, xPercent: -50, duration: 2, ease, overwrite: 'auto' }, 0);

        if (label) {
          tl.to(label, { y: -(h + 8), duration: 2, ease, overwrite: 'auto' }, 0);
        }

        if (white) {
          gsap.set(white, { y: Math.ceil(h + 100), opacity: 0 });
          tl.to(white, { y: 0, opacity: 1, duration: 2, ease, overwrite: 'auto' }, 0);
        }

        tlRefs.current[index] = tl;
      });
    };

    layout();

    const onResize = () => layout();
    window.addEventListener('resize', onResize);

    if (document.fonts?.ready) {
      document.fonts.ready.then(layout).catch(() => {});
    }

    const menu = mobileMenuRef.current;
    if (menu) {
      gsap.set(menu, { visibility: 'hidden', opacity: 0, scaleY: 1 });
    }

    if (initialLoadAnimation) {
      const logo = logoRef.current;
      const navItems = navItemsRef.current;

      if (logo) {
        gsap.set(logo, { scale: 0 });
        gsap.to(logo, {
          scale: 1,
          duration: 0.6,
          ease
        });
      }

      if (navItems) {
        gsap.set(navItems, { width: 0, overflow: 'hidden' });
        gsap.to(navItems, {
          width: 'auto',
          duration: 0.6,
          ease
        });
      }
    }

    return () => window.removeEventListener('resize', onResize);
  }, [items, ease, initialLoadAnimation, gsapReady]);

  const handleEnter = i => {
    if (!window.gsap) return;
    const tl = tlRefs.current[i];
    if (!tl) return;
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(tl.duration(), {
      duration: 0.3,
      ease,
      overwrite: 'auto'
    });
  };

  const handleLeave = i => {
    if (!window.gsap) return;
    const tl = tlRefs.current[i];
    if (!tl) return;
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(0, {
      duration: 0.2,
      ease,
      overwrite: 'auto'
    });
  };

  const handleLogoEnter = () => {
    if (!window.gsap) return;
    const img = logoImgRef.current;
    if (!img) return;
    logoTweenRef.current?.kill();
    window.gsap.set(img, { rotate: 0 });
    logoTweenRef.current = window.gsap.to(img, {
      rotate: 360,
      duration: 0.2,
      ease,
      overwrite: 'auto'
    });
  };

  const toggleMobileMenu = () => {
    if (!window.gsap) return;
    const gsap = window.gsap;
    const newState = !isMobileMenuOpen;
    setIsMobileMenuOpen(newState);

    const hamburger = hamburgerRef.current;
    const menu = mobileMenuRef.current;

    if (hamburger) {
      const lines = hamburger.querySelectorAll('.hamburger-line');
      if (newState) {
        gsap.to(lines[0], { rotation: 45, y: 3, duration: 0.3, ease });
        gsap.to(lines[1], { rotation: -45, y: -3, duration: 0.3, ease });
      } else {
        gsap.to(lines[0], { rotation: 0, y: 0, duration: 0.3, ease });
        gsap.to(lines[1], { rotation: 0, y: 0, duration: 0.3, ease });
      }
    }

    if (menu) {
      if (newState) {
        gsap.set(menu, { visibility: 'visible' });
        gsap.fromTo(
          menu,
          { opacity: 0, y: 10, scaleY: 1 },
          {
            opacity: 1,
            y: 0,
            scaleY: 1,
            duration: 0.3,
            ease,
            transformOrigin: 'top center'
          }
        );
      } else {
        gsap.to(menu, {
          opacity: 0,
          y: 10,
          scaleY: 1,
          duration: 0.2,
          ease,
          transformOrigin: 'top center',
          onComplete: () => {
            gsap.set(menu, { visibility: 'hidden' });
          }
        });
      }
    }

    onMobileMenuClick?.();
  };

  const cssVars = {
    ['--base']: baseColor,
    ['--pill-bg']: pillColor,
    ['--hover-text']: hoveredPillTextColor,
    ['--pill-text']: resolvedPillTextColor
  };

  return (
    <div className="pill-nav-container">
      <nav className={`pill-nav ${className}`} aria-label="Primary" style={cssVars}>
        <a
            className="pill-logo"
            href={items?.[0]?.href || '#'}
            aria-label="Home"
            onClick={(e) => handleLinkClick(e, items?.[0]?.href || '#')}
            onMouseEnter={handleLogoEnter}
            ref={el => {
                logoRef.current = el;
            }}
        >
            <div ref={logoImgRef} className="flex items-center justify-center">
                {logo}
            </div>
        </a>

        <div className="pill-nav-items desktop-only" ref={navItemsRef}>
          <ul className="pill-list" role="menubar">
            {items.map((item, i) => (
              <li key={item.href || `item-${i}`} role="none">
                <a
                  role="menuitem"
                  href={item.href}
                  className={`pill${activeHref === item.href ? ' is-active' : ''}`}
                  aria-label={item.ariaLabel || item.label}
                  onClick={(e) => handleLinkClick(e, item.href)}
                  onMouseEnter={() => handleEnter(i)}
                  onMouseLeave={() => handleLeave(i)}
                >
                  <span
                    className="hover-circle"
                    aria-hidden="true"
                    ref={el => {
                      circleRefs.current[i] = el;
                    }}
                  />
                  <span className="label-stack">
                    <span className="pill-label">{item.label}</span>
                    <span className="pill-label-hover" aria-hidden="true">
                      {item.label}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <button
          className="mobile-menu-button mobile-only"
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
          ref={hamburgerRef}
        >
          <span className="hamburger-line" />
          <span className="hamburger-line" />
        </button>
      </nav>

      <div className="mobile-menu-popover mobile-only" ref={mobileMenuRef} style={cssVars}>
        <ul className="mobile-menu-list">
          {items.map((item, i) => (
            <li key={item.href || `mobile-item-${i}`}>
              <a
                href={item.href}
                className={`mobile-menu-link${activeHref === item.href ? ' is-active' : ''}`}
                onClick={(e) => handleLinkClick(e, item.href)}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

/* --- CircularText Component --- */
const getRotationTransition = (duration, from, loop = true) => ({
  from,
  to: from + 360,
  ease: 'linear',
  duration,
  type: 'tween',
  repeat: loop ? Infinity : 0
});

const getTransition = (duration, from) => ({
  rotate: getRotationTransition(duration, from),
  scale: {
    type: 'spring',
    damping: 20,
    stiffness: 300
  }
});

const CircularText = ({ text, spinDuration = 20, onHover = 'speedUp', className = '' }) => {
  const letters = Array.from(text);
  const controls = useAnimation();
  const rotation = useMotionValue(0);

  useEffect(() => {
    const start = rotation.get();
    controls.start({
      rotate: start + 360,
      scale: 1,
      transition: getTransition(spinDuration, start)
    });
  }, [spinDuration, text, onHover, controls, rotation]);

  const handleHoverStart = () => {
    const start = rotation.get();
    if (!onHover) return;

    let transitionConfig;
    let scaleVal = 1;

    switch (onHover) {
      case 'slowDown':
        transitionConfig = getTransition(spinDuration * 2, start);
        break;
      case 'speedUp':
        transitionConfig = getTransition(spinDuration / 4, start);
        break;
      case 'pause':
        transitionConfig = {
          rotate: { type: 'spring', damping: 20, stiffness: 300 },
          scale: { type: 'spring', damping: 20, stiffness: 300 }
        };
        scaleVal = 1;
        break;
      case 'goBonkers':
        transitionConfig = getTransition(spinDuration / 20, start);
        scaleVal = 0.8;
        break;
      default:
        transitionConfig = getTransition(spinDuration, start);
    }

    controls.start({
      rotate: start + 360,
      scale: scaleVal,
      transition: transitionConfig
    });
  };

  const handleHoverEnd = () => {
    const start = rotation.get();
    controls.start({
      rotate: start + 360,
      scale: 1,
      transition: getTransition(spinDuration, start)
    });
  };

  return (
    <motion.div
      className={`mx-auto rounded-full w-[200px] h-[200px] relative font-black text-center cursor-pointer origin-center ${className}`}
      style={{ rotate: rotation }}
      initial={{ rotate: 0 }}
      animate={controls}
      onMouseEnter={handleHoverStart}
      onMouseLeave={handleHoverEnd}
    >
      {letters.map((letter, i) => {
        const rotationDeg = (360 / letters.length) * i;
        const transform = `rotate(${rotationDeg}deg) translateY(-85px)`; 

        return (
          <span
            key={i}
            className="absolute inline-block inset-0 text-xl transition-all duration-500 ease-[cubic-bezier(0,0,0,1)] text-red-500"
            style={{ 
              transform, 
              WebkitTransform: transform,
              height: '200px', 
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center' 
            }}
          >
            {letter}
          </span>
        );
      })}
    </motion.div>
  );
};

/* --- Reusable Fade-In Wrapper for Scroll Animation --- */
const FadeIn = ({ children, delay = 0, className = "" }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-50px" }}
    transition={{ duration: 0.6, delay, ease: "easeOut" }}
    className={className}
  >
    {children}
  </motion.div>
);

/* --- Main Landing Page Component --- */
export default function AegisLanding() {
  const [formStatus, setFormStatus] = useState('idle');

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleContactSubmit = (e) => {
    e.preventDefault();
    setFormStatus('sending');
    setTimeout(() => {
      setFormStatus('sent');
      setTimeout(() => setFormStatus('idle'), 3000);
    }, 1500);
  };

  // Nav Items configuration
  const navItems = [
    { label: 'Technology', href: '#about' },
    { label: 'Problem', href: '#problem' },
    { label: 'USPs', href: '#usp' },
    { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: '#contact' },
  ];

  return (
    <div className="bg-[#050505] text-[#e2e8f0] font-sans overflow-x-hidden min-h-screen selection:bg-red-500/30 scroll-smooth relative">
      <style>{`
        /* Updated Google Fonts import for variable font support */
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&family=Inter:wght@300..600&display=swap');
        
        .font-display { font-family: 'Space Grotesk', sans-serif; }
        .hero-glow { background: radial-gradient(circle at 50% 50%, rgba(239, 68, 68, 0.15) 0%, rgba(185, 28, 28, 0.05) 50%, transparent 100%); }
        .glass-card { background: rgba(15, 15, 18, 0.6); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); transition: all 0.3s ease; }
        .glass-card:hover { border-color: #ef4444; transform: translateY(-5px); box-shadow: 0 10px 30px -10px rgba(239, 68, 68, 0.2); }
        .gradient-text { background: linear-gradient(90deg, #ef4444, #b91c1c); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        html { scroll-behavior: smooth; }
        
        @keyframes scan {
            0% { top: 0; }
            100% { top: 100%; }
        }
        .scanner-line {
            height: 2px;
            background: #ef4444;
            width: 100%;
            position: absolute;
            z-index: 10;
            animation: scan 3s linear infinite;
            opacity: 0.5;
            box-shadow: 0 0 15px #ef4444;
        }

        /* --- PillNav CSS --- */
        .pill-nav-container {
            position: fixed;
            top: 20px;
            left: 0;
            width: 100%;
            z-index: 100;
            display: flex;
            justify-content: center;
            pointer-events: none;
        }
        .pill-nav {
            pointer-events: auto;
            background: var(--pill-bg, #060010);
            color: var(--base, #fff);
            border-radius: 9999px;
            padding: 0.5rem 1.5rem;
            display: flex;
            align-items: center;
            gap: 1rem;
            box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
            border: 1px solid rgba(255,255,255,0.1);
        }
        .pill-logo {
            display: flex;
            align-items: center;
            justify-content: center;
            text-decoration: none;
            color: inherit;
        }
        .pill-list {
            list-style: none;
            display: flex;
            gap: 0.5rem;
            margin: 0;
            padding: 0;
        }
        .pill {
            position: relative;
            display: inline-flex;
            padding: 0.5rem 1rem;
            text-decoration: none;
            color: var(--pill-text);
            overflow: hidden;
            border-radius: 999px;
            isolation: isolate;
            font-size: 0.9rem;
            font-weight: 500;
        }
        .hover-circle {
            position: absolute;
            background: var(--base);
            border-radius: 50%;
            z-index: -1;
            /* GSAP handles size and pos */
        }
        .label-stack {
            position: relative;
            display: block;
            overflow: hidden;
        }
        .pill-label {
            display: block;
            transition: color 0.3s;
        }
        .pill-label-hover {
            position: absolute;
            top: 0;
            left: 0;
            color: var(--hover-text);
            display: block;
        }
        .mobile-only { display: none; }
        
        @media (max-width: 768px) {
            .desktop-only { display: none; }
            .mobile-only { display: block; }
            .pill-nav-container { top: 10px; padding: 0 20px; box-sizing: border-box; }
            .pill-nav { width: 100%; justify-content: space-between; }
        }

        .mobile-menu-button {
            background: none;
            border: none;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 5px;
        }
        .hamburger-line {
            width: 24px;
            height: 2px;
            background: var(--base);
            display: block;
        }
        .mobile-menu-popover {
            position: fixed;
            top: 80px;
            left: 20px;
            right: 20px;
            background: var(--pill-bg);
            border-radius: 20px;
            padding: 20px;
            border: 1px solid rgba(255,255,255,0.1);
            z-index: 99;
            pointer-events: auto;
        }
        .mobile-menu-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .mobile-menu-link {
            display: block;
            padding: 15px;
            color: var(--base);
            text-decoration: none;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            font-size: 1.1rem;
        }

        /* --- ScrollReveal CSS --- */
        .scroll-reveal {
            overflow: hidden;
        }

        /* --- SpotlightCard CSS --- */
        .card-spotlight {
          position: relative;
          overflow: hidden;
          background: rgba(15, 15, 18, 0.6);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          transition: all 0.3s ease;
        }
        .card-spotlight:hover {
          border-color: #ef4444;
          transform: translateY(-5px);
          box-shadow: 0 10px 30px -10px rgba(239, 68, 68, 0.1);
        }
        .card-spotlight::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(800px circle at var(--mouse-x) var(--mouse-y), var(--spotlight-color), transparent 40%);
          opacity: 0;
          transition: opacity 0.3s;
          pointer-events: none;
          z-index: 1;
        }
        .card-spotlight:hover::before {
          opacity: 1;
        }
        .card-spotlight > * {
          position: relative;
          z-index: 2;
        }

        /* --- Particles CSS --- */
        .particles-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
          pointer-events: none;
        }
      `}</style>

      {/* Pill Nav Replacement */}
      <PillNav 
        logo={<ShieldHalf className="w-6 h-6 text-red-500" />}
        items={navItems}
        baseColor="#e2e8f0"
        pillColor="rgba(20, 5, 5, 0.9)"
        pillTextColor="#e2e8f0"
        hoveredPillTextColor="#000"
      />

      {/* Background Particles - Moved here and made fixed */}
      <div className="fixed inset-0 z-0 pointer-events-none">
          <Particles 
            particleCount={300}
            particleSpread={10}
            speed={0.1}
            particleColors={['#ff0000', '#ff4444', '#ffffff']}
            moveParticlesOnHover={true}
            particleHoverFactor={2}
            alphaParticles={false}
            particleBaseSize={100}
            sizeRandomness={1}
            cameraDistance={20}
            className="w-full h-full"
          />
      </div>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden hero-glow min-h-screen flex flex-col justify-center z-10">
        
        {/* --- Circular Text --- */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.6, scale: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="absolute top-28 right-10 md:right-32 hidden lg:block pointer-events-auto cursor-pointer z-10 scale-75 md:scale-100"
        >
           <CircularText 
              text="SYSTEM SECURE • KERNEL PROTECTION • AEGIS-X • " 
              spinDuration={25}
              onHover="goBonkers"
              className="bg-black/20 backdrop-blur-sm border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.1)]"
           />
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <ShieldHalf className="w-8 h-8 text-red-500/80" />
           </div>
        </motion.div>

        <div className="max-w-7xl mx-auto text-center relative z-10">
          <FadeIn>
            <div className="inline-flex items-center space-x-2 bg-white/5 border border-white/10 px-3 py-1 rounded-full text-xs font-semibold text-red-400 mb-6 uppercase tracking-widest">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <span>Next-Gen Kernel Defense</span>
            </div>
          </FadeIn>
          
          <FadeIn delay={0.1}>
            <h1 className="text-5xl md:text-8xl font-bold mb-6 tracking-tighter leading-tight font-display">
              Self-Evolving <br/>
              <VariableProximity
                label={'Cyber Immunity'}
                className={'gradient-text cursor-default'}
                fromFontVariationSettings="'wght' 400"
                toFontVariationSettings="'wght' 800"
                radius={100}
                falloff="gaussian"
              />
            </h1>
          </FadeIn>

          <FadeIn delay={0.2}>
            <p className="max-w-2xl mx-auto text-gray-400 text-lg md:text-xl mb-10 leading-relaxed">
              Combating polymorphic malware with a biological-style immune system. Zero latency, total privacy, and autonomous edge evolution.
            </p>
          </FadeIn>

          <FadeIn delay={0.3}>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4">
              <button 
                onClick={() => scrollToSection('about')}
                className="w-full md:w-auto px-8 py-4 bg-red-600 text-white font-bold rounded-xl hover:shadow-[0_0_20px_rgba(239,68,68,0.5)] hover:scale-105 transition-all flex items-center justify-center space-x-2"
              >
                <span>View Architecture</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </FadeIn>
        </div>

        {/* Abstract Visualizer */}
        <FadeIn delay={0.5} className="w-full">
          <SpotlightCard className="max-w-5xl mx-auto mt-20 relative rounded-2xl p-4 aspect-video overflow-hidden group" spotlightColor="rgba(239, 68, 68, 0.1)">
            <div className="scanner-line"></div>
            <div className="w-full h-full bg-black/40 rounded-xl flex items-center justify-center border border-white/5">
              <div className="text-left space-y-4 w-full p-8 font-mono text-sm">
                <div className="text-green-500">[SYSTEM] Monitoring kernel system calls via eBPF...</div>
                <div className="text-red-400">[DETECTION] Suspicious write pattern detected in /usr/bin/</div>
                <div className="text-orange-400">[EVOLUTION] Instantiating Genetic Engine...</div>
                <div className="pl-4 text-gray-500">&gt; Generation 1: Rule Fitness 64%</div>
                <div className="pl-4 text-gray-500">&gt; Generation 4: Rule Fitness 99.2%</div>
                <div className="text-yellow-500">[SANDBOX] Validating Rule-X90 in Firecracker VMM... Passed.</div>
                <div className="text-red-500 font-bold">[AEGIS-X] New Rule Hot-Patched. Threat Neutralized.</div>
              </div>
            </div>
          </SpotlightCard>
        </FadeIn>
      </section>

      {/* The Problem: The Triad of Vulnerability */}
      <section id="problem" className="py-24 px-6 bg-black/50 relative z-10">
        <div className="max-w-7xl mx-auto">
          <FadeIn>
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4 font-display">The <span className="text-red-500">Triad of Vulnerability</span></h2>
              <p className="text-gray-400 max-w-2xl mx-auto">Why traditional signature-based detection fails against modern threats.</p>
            </div>
          </FadeIn>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Problem 1: Polymorphism */}
            <FadeIn delay={0.1}>
              <SpotlightCard className="p-8 rounded-3xl relative overflow-hidden group h-full" spotlightColor="rgba(239, 68, 68, 0.15)">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
                  <Ghost className="w-24 h-24 text-red-500" />
                </div>
                <div className="w-12 h-12 bg-red-500/10 rounded-lg flex items-center justify-center mb-6">
                  <Shuffle className="text-red-500 w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold mb-4 font-display">Polymorphism</h3>
                <p className="text-gray-400 leading-relaxed text-sm">
                  Malware rewrites its own code structure upon every execution. This renders static hash-based signatures completely useless, as the "fingerprint" changes constantly.
                </p>
              </SpotlightCard>
            </FadeIn>

            {/* Problem 2: Offline Constraint */}
            <FadeIn delay={0.2}>
              <SpotlightCard className="p-8 rounded-3xl relative overflow-hidden group h-full" spotlightColor="rgba(239, 68, 68, 0.15)">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
                  <CloudOff className="w-24 h-24 text-red-500" />
                </div>
                <div className="w-12 h-12 bg-red-500/10 rounded-lg flex items-center justify-center mb-6">
                  <Server className="text-red-500 w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold mb-4 font-display">Offline Constraint</h3>
                <p className="text-gray-400 leading-relaxed text-sm">
                  Critical systems often cannot rely on cloud lookups due to latency or security protocols. Edge devices need to preserve privacy and act autonomously without internet dependency.
                </p>
              </SpotlightCard>
            </FadeIn>

            {/* Problem 3: The Safety Paradox */}
            <FadeIn delay={0.3}>
              <SpotlightCard className="p-8 rounded-3xl relative overflow-hidden group h-full" spotlightColor="rgba(239, 68, 68, 0.15)">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
                  <Skull className="w-24 h-24 text-red-500" />
                </div>
                <div className="w-12 h-12 bg-red-500/10 rounded-lg flex items-center justify-center mb-6">
                  <ShieldAlert className="text-red-500 w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold mb-4 font-display">The Safety Paradox</h3>
                <p className="text-gray-400 leading-relaxed text-sm">
                  The defense logic itself is a potential attack surface. Evolving rules aggressively can block threats, but without validation, they risk corrupting the host OS.
                </p>
              </SpotlightCard>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* How it Works (OODA) */}
      <section id="about" className="py-24 px-6 relative z-10">
        <FadeIn>
          <div className="max-w-7xl mx-auto text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 font-display">The Cyber OODA Loop</h2>
            <p className="text-gray-400">A biological-style immune response for your operating system.</p>
          </div>
        </FadeIn>
        
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8">
          {/* Step 1 */}
          <FadeIn delay={0.1} className="h-full">
            <div className="relative group h-full">
              <SpotlightCard className="p-8 rounded-3xl h-full border-t-4 border-t-red-500" spotlightColor="rgba(239, 68, 68, 0.15)">
                <div className="text-red-400 mb-6 bg-red-500/10 w-14 h-14 rounded-full flex items-center justify-center">
                  <Eye className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3 font-display">Observe</h3>
                <p className="text-gray-500 text-sm">eBPF-driven kernel monitoring tracks every system call. We watch behavior, not code.</p>
              </SpotlightCard>
              <div className="hidden md:block absolute top-1/2 -right-4 translate-y-1/2 z-10">
                <ChevronRight className="text-gray-700 w-8 h-8" />
              </div>
            </div>
          </FadeIn>

          {/* Step 2 */}
          <FadeIn delay={0.2} className="h-full">
            <div className="relative group h-full">
              <SpotlightCard className="p-8 rounded-3xl h-full border-t-4 border-t-orange-500" spotlightColor="rgba(249, 115, 22, 0.15)">
                <div className="text-orange-400 mb-6 bg-orange-500/10 w-14 h-14 rounded-full flex items-center justify-center">
                  <Dna className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3 font-display">Orient</h3>
                <p className="text-gray-500 text-sm">Genetic algorithms identify the malicious core and mutate new detection "DNA" automatically.</p>
              </SpotlightCard>
              <div className="hidden md:block absolute top-1/2 -right-4 translate-y-1/2 z-10">
                 <ChevronRight className="text-gray-700 w-8 h-8" />
              </div>
            </div>
          </FadeIn>

          {/* Step 3 */}
          <FadeIn delay={0.3} className="h-full">
            <div className="relative group h-full">
              <SpotlightCard className="p-8 rounded-3xl h-full border-t-4 border-t-yellow-500" spotlightColor="rgba(234, 179, 8, 0.15)">
                <div className="text-yellow-400 mb-6 bg-yellow-500/10 w-14 h-14 rounded-full flex items-center justify-center">
                  <FlaskConical className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3 font-display">Decide</h3>
                <p className="text-gray-500 text-sm">New rules are validated in a Firecracker MicroVM to ensure host stability and solve the <strong>Safety Paradox</strong>.</p>
              </SpotlightCard>
              <div className="hidden md:block absolute top-1/2 -right-4 translate-y-1/2 z-10">
                 <ChevronRight className="text-gray-700 w-8 h-8" />
              </div>
            </div>
          </FadeIn>

          {/* Step 4 */}
          <FadeIn delay={0.4} className="h-full">
            <SpotlightCard className="p-8 rounded-3xl h-full border-t-4 border-t-green-500 ring-1 ring-green-500/30" spotlightColor="rgba(34, 197, 94, 0.15)">
              <div className="text-green-400 mb-6 bg-green-500/10 w-14 h-14 rounded-full flex items-center justify-center">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 font-display">Act</h3>
              <p className="text-gray-500 text-sm">Rules are hot-patched into the kernel. The system evolves before the threat can even complete its task.</p>
            </SpotlightCard>
          </FadeIn>
        </div>
      </section>

      {/* USP Section */}
      <section id="usp" className="py-24 px-6 bg-gradient-to-b from-black to-[#0a0a0c] relative z-10">
        <div className="max-w-7xl mx-auto">
          <FadeIn>
            <h2 className="text-4xl font-bold mb-12 font-display text-center">Why <span className="text-red-500">Aegis-X?</span></h2>
          </FadeIn>
          
          <div className="grid md:grid-cols-3 gap-8">
            <FadeIn delay={0.1} className="h-full">
              <div className="p-1 rounded-3xl bg-gradient-to-br from-red-500/20 to-transparent h-full">
                <SpotlightCard className="bg-[#0f0f12] p-8 rounded-[calc(1.5rem-1px)] h-full hover:bg-[#151518] transition-colors" spotlightColor="rgba(239, 68, 68, 0.25)">
                  <Brain className="text-red-400 mb-4 w-6 h-6" />
                  <h4 className="text-lg font-bold mb-2 font-display">Behavioral Integrity</h4>
                  <p className="text-gray-500 text-sm">Solves <strong>Polymorphism</strong>. We block rapid file writes or unauthorized memory access regardless of how the virus is obfuscated.</p>
                </SpotlightCard>
              </div>
            </FadeIn>

            <FadeIn delay={0.2} className="h-full">
              <div className="p-1 rounded-3xl bg-gradient-to-br from-orange-500/20 to-transparent h-full">
                <SpotlightCard className="bg-[#0f0f12] p-8 rounded-[calc(1.5rem-1px)] h-full hover:bg-[#151518] transition-colors" spotlightColor="rgba(249, 115, 22, 0.25)">
                  <WifiOff className="text-orange-400 mb-4 w-6 h-6" />
                  <h4 className="text-lg font-bold mb-2 font-display">Offline Advantage</h4>
                  <p className="text-gray-500 text-sm">Solves the <strong>Offline Constraint</strong>. Zero cloud dependency. Operates locally on the edge, perfect for privacy and eliminating latency.</p>
                </SpotlightCard>
              </div>
            </FadeIn>

            <FadeIn delay={0.3} className="h-full">
              <div className="p-1 rounded-3xl bg-gradient-to-br from-green-500/20 to-transparent h-full">
                <SpotlightCard className="bg-[#0f0f12] p-8 rounded-[calc(1.5rem-1px)] h-full hover:bg-[#151518] transition-colors" spotlightColor="rgba(34, 197, 94, 0.25)">
                  <Layers className="text-green-400 mb-4 w-6 h-6" />
                  <h4 className="text-lg font-bold mb-2 font-display">Safe Evolution</h4>
                  <p className="text-gray-500 text-sm">Solves the <strong>Safety Paradox</strong>. Using sandboxed MicroVMs, we ensure new rules never accidentally corrupt the host OS.</p>
                </SpotlightCard>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-6 relative z-10">
        <div className="max-w-3xl mx-auto">
          <FadeIn>
            <h2 className="text-4xl font-bold mb-12 font-display text-center">Frequently Asked Questions</h2>
          </FadeIn>
          
          <div className="space-y-4">
            <FadeIn delay={0.1}>
              <details className="group glass-card rounded-2xl p-6 open:border-red-500/50" open>
                <summary className="flex justify-between items-center font-bold cursor-pointer list-none select-none">
                  <span>How does this differ from traditional EDR?</span>
                  <Plus className="group-open:rotate-45 transition-transform duration-300 text-red-400 w-5 h-5" />
                </summary>
                <p className="text-gray-500 mt-4 text-sm leading-relaxed">
                  Most EDRs collect data to be analyzed later in the cloud. Aegis-X evolved detection rules *on the device* and patches them into the kernel immediately, preventing the breach before data exfiltration occurs.
                </p>
              </details>
            </FadeIn>

            <FadeIn delay={0.2}>
              <details className="group glass-card rounded-2xl p-6 open:border-red-500/50">
                <summary className="flex justify-between items-center font-bold cursor-pointer list-none select-none">
                  <span>Does eBPF cause performance lag?</span>
                  <Plus className="group-open:rotate-45 transition-transform duration-300 text-red-400 w-5 h-5" />
                </summary>
                <p className="text-gray-500 mt-4 text-sm leading-relaxed">
                  No. eBPF is designed to run in a highly efficient JIT-compiled environment within the kernel. It is significantly faster than traditional user-space monitoring or heavy kernel modules.
                </p>
              </details>
            </FadeIn>

            <FadeIn delay={0.3}>
              <details className="group glass-card rounded-2xl p-6 open:border-red-500/50">
                <summary className="flex justify-between items-center font-bold cursor-pointer list-none select-none">
                  <span>Can it detect Zero-Day vulnerabilities?</span>
                  <Plus className="group-open:rotate-45 transition-transform duration-300 text-red-400 w-5 h-5" />
                </summary>
                <p className="text-gray-500 mt-4 text-sm leading-relaxed">
                  Yes. Because we focus on "System Behavior" (the outcome of an attack) rather than the exploit code itself, we can stop attacks that use vulnerabilities the world hasn't seen yet.
                </p>
              </details>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Contact / About Us */}
      <section id="contact" className="py-24 px-6 bg-[#0a0a0c] border-t border-white/5 relative z-10">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16">
          <FadeIn>
            <div className="flex flex-col h-full">
              <h2 className="text-4xl font-bold mb-6 font-display">About Team <span className="text-red-500">KavachX</span></h2>
              {/* Applied ScrollReveal to the description text */}
              <ScrollReveal 
                textClassName="text-gray-400 mb-8 leading-relaxed block" 
                baseOpacity={0} 
                enableBlur={true}
                baseRotation={0}
                containerClassName="block"
              >
                We are a group of security researchers and systems engineers dedicated to closing the time-gap in digital defense. Aegis-X is our vision for a truly autonomous, self-healing operating system.
              </ScrollReveal>
              
              <div className="flex space-x-6 mt-auto">
                <a href="#" className="text-gray-500 hover:text-white transition-colors hover:scale-110 transform duration-200"><Github className="w-6 h-6" /></a>
                <a href="#" className="text-gray-500 hover:text-white transition-colors hover:scale-110 transform duration-200"><Twitter className="w-6 h-6" /></a>
                <a href="#" className="text-gray-500 hover:text-white transition-colors hover:scale-110 transform duration-200"><Linkedin className="w-6 h-6" /></a>
              </div>
            </div>
          </FadeIn>
          
          <FadeIn delay={0.2}>
            <SpotlightCard className="glass-card p-8 rounded-3xl relative overflow-hidden" spotlightColor="rgba(239, 68, 68, 0.25)">
              <h3 className="text-xl font-bold mb-6 font-display">Contact the Lab</h3>
              <form className="space-y-4" onSubmit={handleContactSubmit}>
                <div>
                   <input required type="email" placeholder="Email Address" className="w-full bg-white/5 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-red-500 focus:bg-white/10 transition-all text-white placeholder-gray-500" />
                </div>
                <div>
                   <textarea required placeholder="Message" rows="4" className="w-full bg-white/5 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-red-500 focus:bg-white/10 transition-all text-white placeholder-gray-500"></textarea>
                </div>
                
                <button 
                  type="submit" 
                  disabled={formStatus !== 'idle'}
                  className={`w-full py-4 font-bold rounded-xl transition-all flex items-center justify-center space-x-2
                    ${formStatus === 'sent' 
                      ? 'bg-green-500 text-black' 
                      : 'bg-red-600 text-white hover:bg-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                    }`}
                >
                  {formStatus === 'idle' && <><span>Send Transmission</span><Send className="w-4 h-4" /></>}
                  {formStatus === 'sending' && <Loader2 className="w-5 h-5 animate-spin" />}
                  {formStatus === 'sent' && <><span>Message Received</span><CheckCircle2 className="w-5 h-5" /></>}
                </button>
              </form>
            </SpotlightCard>
          </FadeIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/5 text-center text-gray-600 text-xs">
        <p>&copy; 2024 Team KavachX. Aegis-X is an open-source research project.</p>
        <p className="mt-2">Built with eBPF & Genetic Evolution Logic.</p>
      </footer>
    </div>
  );
}