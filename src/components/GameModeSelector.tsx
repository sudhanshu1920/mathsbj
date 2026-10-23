import { useRef } from "react";
import { ArrowLeft, CarFront, Gamepad2, Mountain, Rocket, Sparkles } from "lucide-react";
import "./mcq-game-selector.css";

export type MCQGameVariant = "car" | "jump" | "shooter";

interface GameModeSelectorProps {
  selectedGame: MCQGameVariant;
  onBack: () => void;
  onSelect: (game: MCQGameVariant) => void;
}

const GameModeSelector = ({ selectedGame, onBack, onSelect }: GameModeSelectorProps) => {
  const selectionLockedRef = useRef(false);

  const chooseGame = (game: MCQGameVariant) => {
    if (selectionLockedRef.current) return;
    selectionLockedRef.current = true;
    onSelect(game);
  };

  return (
    <section className="mcq-game-select-shell" aria-label="Choose a quiz game" data-testid="mcq-game-selector">
      <header className="mcq-game-select-topbar">
        <button
          type="button"
          className="mcq-game-select-back"
          onClick={onBack}
          aria-label="Back to Answer Mode"
        >
          <ArrowLeft size={19} aria-hidden="true" />
          <span>Back</span>
        </button>
        <span className="mcq-game-select-kicker">MATH ARCADE</span>
        <span className="mcq-game-select-spacer" aria-hidden="true" />
      </header>

      <main className="mcq-game-select-content">
        <div className="mcq-game-select-intro">
          <span className="mcq-game-select-eyebrow"><Sparkles size={14} aria-hidden="true" /> PICK YOUR ADVENTURE</span>
          <h1>Choose your game</h1>
          <p>Same Math Quiz Engine. Three different ways to play.</p>
        </div>

        <div className="mcq-game-select-cards">
          <button
            type="button"
            className={"mcq-game-select-card mcq-game-select-card--racing" + (selectedGame === "car" ? " is-selected" : "")}
            onClick={() => chooseGame("car")}
            aria-label="3D Math Car Racing. Drive through answer gates."
            data-testid="select-car-racing"
          >
            <span className="mcq-game-select-art mcq-game-select-art--car" aria-hidden="true">
              <span className="mcq-game-select-sun" />
              <span className="mcq-game-select-road" />
              <span className="mcq-game-select-car"><CarFront size={49} strokeWidth={2.3} /></span>
              <span className="mcq-game-select-orb mcq-game-select-orb--one">7</span>
              <span className="mcq-game-select-orb mcq-game-select-orb--two">×</span>
            </span>
            <span className="mcq-game-select-card-copy">
              <span className="mcq-game-select-card-title">3D Math Car Racing</span>
              <span className="mcq-game-select-card-description">Steer into answer gates to solve each question. Hold a side to boost.</span>
              <span className="mcq-game-select-card-action">Select racing <span aria-hidden="true">→</span></span>
            </span>
          </button>

          <button
            type="button"
            className={"mcq-game-select-card mcq-game-select-card--jump" + (selectedGame === "jump" ? " is-selected" : "")}
            onClick={() => chooseGame("jump")}
            aria-label="2D Math Jump Adventure. Move and jump across colorful platforms."
            data-testid="select-jump-adventure"
          >
            <span className="mcq-game-select-art mcq-game-select-art--jump" aria-hidden="true">
              <span className="mcq-game-select-cloud mcq-game-select-cloud--one" />
              <span className="mcq-game-select-cloud mcq-game-select-cloud--two" />
              <span className="mcq-game-select-platform mcq-game-select-platform--one" />
              <span className="mcq-game-select-platform mcq-game-select-platform--two" />
              <span className="mcq-game-select-hero"><Mountain size={37} strokeWidth={2.5} /></span>
              <span className="mcq-game-select-star"><Sparkles size={17} /></span>
              <span className="mcq-game-select-orb mcq-game-select-orb--three">+</span>
            </span>
            <span className="mcq-game-select-card-copy">
              <span className="mcq-game-select-card-title">2D Math Jump Adventure</span>
              <span className="mcq-game-select-card-description">Move, jump, explore platforms, and answer through the shared quiz engine.</span>
              <span className="mcq-game-select-card-action">Start jumping <span aria-hidden="true">→</span></span>
            </span>
          </button>

          <button
            type="button"
            className={"mcq-game-select-card mcq-game-select-card--shooter" + (selectedGame === "shooter" ? " is-selected" : "")}
            onClick={() => chooseGame("shooter")}
            aria-label="Math Space Shooter. Aim and fire at mathematical answer targets."
            data-testid="select-space-shooter"
          >
            <span className="mcq-game-select-art mcq-game-select-art--shooter" aria-hidden="true">
              <span className="mcq-space-select-nebula" />
              <span className="mcq-space-select-star mcq-space-select-star--one">✦</span>
              <span className="mcq-space-select-star mcq-space-select-star--two">✧</span>
              <span className="mcq-space-select-target mcq-space-select-target--one">12</span>
              <span className="mcq-space-select-target mcq-space-select-target--two">8</span>
              <span className="mcq-space-select-laser" />
              <span className="mcq-space-select-ship"><Rocket size={45} strokeWidth={2.2} /></span>
            </span>
            <span className="mcq-game-select-card-copy">
              <span className="mcq-game-select-card-title">Math Space Shooter</span>
              <span className="mcq-game-select-card-description">Pilot a colorful starship, aim at answer targets, and fire through the shared quiz engine.</span>
              <span className="mcq-game-select-card-action">Launch mission <span aria-hidden="true">→</span></span>
            </span>
          </button>
        </div>

        <p className="mcq-game-select-footnote"><Gamepad2 size={15} aria-hidden="true" /> Start a new game or continue the active quiz with another game mode.</p>
      </main>
    </section>
  );
};

export default GameModeSelector;
