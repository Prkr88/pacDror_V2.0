function img(src) {
  const i = new Image();
  i.src = src;
  return i;
}

// Player animation frames — 4 directions × 4 frames
export const DrorRight = [1,2,3,4].map(n => img(`images/pacDrorAni_right${n}.svg`));
export const DrorLeft  = [1,2,3,4].map(n => img(`images/pacDrorAni_left${n}.svg`));
export const DrorUp    = [1,2,3,4].map(n => img(`images/pacDrorAni_up${n}.svg`));
export const DrorDown  = [1,2,3,4].map(n => img(`images/pacDrorAni_down${n}.svg`));

export const ghosts = [
  img('images/Haim_1.svg'),
  img('images/Haim_2.svg'),
  img('images/Haim_3.svg'),
];

export const imgWall      = img('images/wall.svg');
export const imgFloor     = img('images/floor.svg');
export const imgFood      = img('images/food_simple.svg');
export const imgDiamond   = img('images/diamond.svg');
export const imgFoodSp    = img('images/food_special.svg');
export const imgSkull     = img('images/skull.svg');
export const imgVictory   = img('images/victory.svg');
export const imgGameOver  = img('images/GameOver.svg');
export const imgCanDoBttr = img('images/canDoBetter.svg');
export const imgNum1      = img('images/num_1.svg');
export const imgNum2      = img('images/num_2.svg');
export const imgNum3      = img('images/num_3.svg');
export const imgWelcome   = img('images/img_welcome.png');

class Sound {
  constructor(src, loop = false) {
    this._a = new Audio(src);
    this._a.preload = 'auto';
    this._a.loop = loop;
  }
  play() {
    if (this._a.loop) {
      if (this._a.paused) this._a.play().catch(() => {});
    } else {
      this._a.currentTime = 0;
      this._a.play().catch(() => {});
    }
  }
  stop() { this._a.pause(); this._a.currentTime = 0; }
}

export const sounds = {
  bg:       new Sound('sounds/BackgroundMusic.mp3', true),
  killed:   new Sound('sounds/killed.mp3'),
  gameOver: new Sound('sounds/gameOver.mp3'),
  skull:    new Sound('sounds/sharvit.mp3'),
  complete: new Sound('sounds/gameFinished2.mp3'),
  eatSimple:new Sound('sounds/eatHatzir.mp3'),
  eatSpec:  new Sound('sounds/Tetet.mp3'),
};
