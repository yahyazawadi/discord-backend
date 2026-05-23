import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import './Preloader.css';

interface PreloaderProps {
  onComplete: () => void;
}

export default function Preloader({ onComplete }: PreloaderProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    // Prevent scrolling while preloading is active
    document.body.style.overflow = 'hidden';

    const tl = gsap.timeline({
      onComplete: () => {
        document.body.style.overflow = '';
        onComplete();
      }
    });

    // 1. Initial State & Glow entrance
    tl.set(overlayRef.current, { yPercent: 0 });
    tl.fromTo(glowRef.current,
      { opacity: 0, scale: 0.8 },
      { opacity: 1, scale: 1, duration: 0.8, ease: 'power2.out' }
    );

    // 2. Staggered logo paths entrance
    // Animating individual SVG paths with a springy slide-up scale-in effect
    tl.fromTo('.preloader-logo path',
      { 
        opacity: 0, 
        scale: 0.6, 
        y: 30, 
        transformOrigin: 'center center' 
      },
      { 
        opacity: 1, 
        scale: 1, 
        y: 0, 
        duration: 0.5, 
        stagger: 0.03, 
        ease: 'back.out(1.6)' 
      },
      '-=0.55' // Overlap with glow animation
    );

    // 3. Organic non-linear progress counter & progress bar animation
    const progressObj = { value: 0 };
    tl.to('.preloader-progress-bar', {
      width: '100%',
      duration: 1.3,
      ease: 'power3.inOut'
    }, '-=0.1');

    tl.to(progressObj, {
      value: 100,
      duration: 1.3,
      ease: 'power3.inOut',
      onUpdate: () => {
        setPercent(Math.floor(progressObj.value));
      }
    }, '<'); // Run simultaneously with progress bar width animation

    // 4. Logo scale/pulse pop at 100% completion
    tl.to('.preloader-logo', {
      scale: 1.08,
      duration: 0.18,
      ease: 'power2.out'
    });

    tl.to('.preloader-logo', {
      scale: 1.0,
      duration: 0.15,
      ease: 'power2.inOut'
    });

    // 5. Exit Transition: Fade out contents & Slide up the background panel
    tl.to(contentRef.current, {
      opacity: 0,
      y: -50,
      scale: 0.95,
      duration: 0.35,
      ease: 'power3.in'
    }, '+=0.05');

    tl.to(overlayRef.current, {
      yPercent: -100,
      duration: 0.7,
      ease: 'power4.inOut'
    }, '-=0.25');

    return () => {
      document.body.style.overflow = '';
    };
  }, [onComplete]);

  return (
    <div ref={overlayRef} className="preloader-overlay">
      {/* Background ambient glow matching primary color */}
      <div ref={glowRef} className="preloader-glow" />

      <div ref={contentRef} className="preloader-content">
        {/* Inline squad.svg to animate each path separately */}
        <svg 
          className="preloader-logo" 
          width="234" 
          height="200" 
          viewBox="0 0 234 200" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* S-shaped main ribbon path */}
          <path d="M123.742 77.8538L108.597 72.8497C96.2304 68.2664 84.4943 58.4595 86.0207 45.6663C81.8744 44.4399 77.6979 43.1109 73.8396 43.419C64.9369 44.1318 57.1095 50.5476 56.1993 59.0798C55.4301 66.293 58.0358 72.4167 63.9602 75.9468L63.9401 75.9508C63.9401 75.9508 68.3341 78.6231 71.8601 79.6863C74.4578 80.4697 77.2892 81.4886 79.1821 82.2397L80.6763 82.868C80.7145 82.8861 80.7588 82.9043 80.7951 82.9224C80.8011 82.9244 80.8092 82.9224 80.8152 82.9264L108.138 94.4047C108.931 94.739 109.771 96.6963 109.634 97.5179C109.493 98.3597 107.838 98.992 106.573 99.0081L64.3509 99.5558C58.0358 99.6384 55.4724 106.934 56.0886 111.94C56.6806 116.749 61.0021 121.338 66.7855 121.353L120.353 121.489C126.63 121.506 132.894 120.178 137.701 115.523C145.627 107.848 146.296 95.325 139.816 86.7787C135.834 81.5289 129.707 79.8253 123.744 77.8558L123.742 77.8538Z" fill="#14AC7B"/>
          
          {/* Secondary abstract overlay path */}
          <path d="M177.588 58.963C176.939 50.024 168.969 44.3735 160.719 43.429C156.522 42.9498 152.354 44.5003 148.048 45.6864C147.233 51.0329 150.519 54.7482 146.931 61.8164C146.202 63.2542 141.3 62.6803 140.908 61.0834L140.183 48.6245C139.689 40.1567 131.509 30.5995 123.6 29.9048C121.92 29.7578 119.479 29.6329 118.021 29.6873L111.163 29.943C102.792 30.2552 95.2059 38.6847 94.0842 46.6067C93.1297 53.3507 95.8946 59.7785 101.877 62.044C108.098 64.398 114.115 66.3816 120.44 68.3852C131.183 71.7864 141.423 73.8022 148.044 83.2003C152.893 90.0832 153.268 97.8885 152.66 106.592C159.466 103.936 165.397 101.211 171.549 98.1462C175.848 96.0056 177.833 91.1545 177.854 86.1947C177.89 77.1671 178.27 68.3913 177.586 58.963H177.588Z" fill="#14AC7B"/>
          
          {/* Geometric circular shape path */}
          <path d="M120.679 27.7058C128.412 26.2479 132.325 18.344 130.825 11.0522C129.383 4.04644 122.578 -0.985888 115.009 0.163954C106.65 1.43261 101.432 9.12105 103.142 16.8941C104.874 24.7617 111.916 29.3611 120.679 27.7058V27.7058Z" fill="#14AC7B"/>
          
          {/* Small dot path */}
          <path d="M158.004 41.5179C164.023 42.0778 169.327 37.9416 171.075 32.6011C173.02 26.6606 170.699 20.5248 164.861 17.5525C161.19 15.6837 157.974 15.6777 154.289 16.9927C148.531 19.0467 145.334 25.0597 146.419 30.9056C147.482 36.6367 152.263 40.9843 158.004 41.5179Z" fill="#14AC7B"/>
          
          {/* Another small dot path */}
          <path d="M74.5063 41.7114C82.2632 41.9973 88.0567 35.5916 87.6137 27.8528C87.211 20.8249 80.4952 15.4523 73.0564 16.4752C67.569 17.2304 63.4932 20.8672 62.5186 26.7533C61.2197 34.5968 67.1824 41.4415 74.5043 41.7114H74.5063Z" fill="#14AC7B"/>
          
          {/* "S" character path */}
          <path d="M0 174.773H9.64377C9.64377 178.915 13.4759 181.696 19.2271 181.696C23.6775 181.696 26.6457 179.719 26.6457 176.813C26.6457 173.907 24.9139 172.608 20.6488 171.867L14.219 170.816C5.56395 169.332 0.988744 165.808 0.988744 157.71C0.988744 149.613 8.03682 144.295 18.6089 144.295C29.181 144.295 36.1667 149.982 36.1667 157.896H26.3376C26.3376 154.309 23.309 151.961 18.6713 151.961C14.3438 151.961 11.438 154.001 11.438 157.092C11.438 159.875 13.5404 161.605 17.6202 162.286L23.9252 163.399C32.1473 164.883 36.9077 168.468 36.9077 176.074C36.9077 184.173 29.8597 189.552 19.2271 189.552C7.91398 189.552 0 183.432 0 174.775L0 174.773Z" fill="#14AC7B"/>
          
          {/* "Q" character path */}
          <path d="M81.8542 184.727L89.7057 193.692L82.7825 199.626L72.891 188.807C70.9136 189.239 68.8716 189.487 66.6464 189.487C52.7356 189.487 43.0918 180.214 43.0918 166.921C43.0918 153.629 52.7356 144.355 66.6464 144.355C80.5573 144.355 90.2011 153.629 90.2011 166.921C90.2011 174.463 87.11 180.707 81.8542 184.727ZM66.6444 181.078C74.6813 181.078 80.3701 175.266 80.3701 166.921C80.3701 158.576 74.6833 152.765 66.6444 152.765C58.6056 152.765 52.9188 158.576 52.9188 166.921C52.9188 175.266 58.5452 181.078 66.6444 181.078Z" fill="#14AC7B"/>
          
          {/* "U" character path */}
          <path d="M96.5669 169.579V145.284H106.336V169.704C106.336 176.567 110.54 181.017 116.908 181.017C123.275 181.017 127.542 176.567 127.542 169.704V145.284H137.311V169.579C137.311 181.821 129.459 189.548 116.91 189.548C104.36 189.548 96.5689 181.819 96.5689 169.579H96.5669Z" fill="#14AC7B"/>
          
          {/* "A" character path */}
          <path d="M159.256 145.284H168.407L187.634 188.559H177.309L173.6 179.719H154.125L150.354 188.559H139.967L159.256 145.284ZM170.322 171.742L163.83 156.349L157.337 171.742H170.32H170.322Z" fill="#14AC7B"/>
          
          {/* "D" character path */}
          <path d="M192.64 145.284H209.765C224.54 145.284 234 153.816 234 166.921C234 180.027 224.542 188.559 209.765 188.559H192.64V145.284ZM209.084 180.274C218.11 180.274 224.107 174.958 224.107 166.921C224.107 158.884 218.11 153.568 209.084 153.568H202.346V180.276H209.084V180.274Z" fill="#14AC7B"/>
        </svg>

        {/* Progress track & loading bar */}
        <div className="preloader-progress-track">
          <div className="preloader-progress-bar" />
        </div>

        {/* Dynamic percentage counter */}
        <div className="preloader-percentage">{percent}%</div>
      </div>
    </div>
  );
}
