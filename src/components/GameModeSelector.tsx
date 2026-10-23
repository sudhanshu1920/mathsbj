import { useRef, useState } from "react";
import { ArrowLeft, CarFront, Check, Gamepad2, Mountain, Play, Rocket, Scissors, Sparkles, X } from "lucide-react";
import "./mcq-game-selector.css";

export type MCQGameVariant = "car" | "jump" | "shooter" | "slice";
type SelectorVariant = "screen" | "modal";

interface GameModeSelectorProps {
  selectedGame: MCQGameVariant;
  onBack: () => void;
  onSelect: (game: MCQGameVariant) => void;
  variant?: SelectorVariant;
  canStartQuiz?: boolean;
  errorMessage?: string | null;
  onStart?: (game: MCQGameVariant) => boolean | void;
}

const GAME_OPTIONS: ReadonlyArray<{
  id: MCQGameVariant;
  title: string;
  description: string;
  action: string;
  ariaLabel: string;
}> = [
  {
    id: "car",
    title: "3D Car Racing",
    description: "Race and solve.",
    action: "Select racing",
    ariaLabel: "3D Car Racing. Race and solve.",
  },
  {
    id: "jump",
    title: "2D Jump Adventure",
    description: "Jump and answer.",
    action: "Select adventure",
    ariaLabel: "2D Jump Adventure. Jump and answer.",
  },
  {
    id: "shooter",
    title: "Space Shooter",
    description: "Aim, shoot and solve.",
    action: "Select shooter",
    ariaLabel: "Space Shooter. Aim, shoot and solve.",
  },
  { id: "slice", title: "Math Slice Ninja", description: "Swipe. Slice. Solve.", action: "Select Slice Ninja", ariaLabel: "Math Slice Ninja. Swipe, slice and solve." },
];

const GameModeSelector = ({
  selectedGame,
  onBack,
  onSelect,
  variant = "screen",
  canStartQuiz = true,
  errorMessage,
  onStart,
}: GameModeSelectorProps) => {
  const selectionLockedRef = useRef(false);
  const startLockedRef = useRef(false);
  const [selectedChoice, setSelectedChoice] = useState<MCQGameVariant | null>(
    variant === "modal" ? null : selectedGame,
  );
  const [starting, setStarting] = useState(false);
  const [localStartError, setLocalStartError] = useState<string | null>(null);
  const isModal = variant === "modal";

  const chooseGame = (game: MCQGameVariant) => {
    if (starting) return;
    if (!isModal) {
      if (selectionLockedRef.current) return;
      selectionLockedRef.current = true;
      onSelect(game);
      return;
    }
    setSelectedChoice(game);
    setLocalStartError(null);
    onSelect(game);
  };

  const startSelectedGame = () => {
    if (!isModal || !selectedChoice || !canStartQuiz || startLockedRef.current) return;
    startLockedRef.current = true;
    setStarting(true);
    setLocalStartError(null);
    try {
      const started = onStart?.(selectedChoice);
      if (started === false) {
        startLockedRef.current = false;
        setStarting(false);
      }
    } catch {
      startLockedRef.current = false;
      setStarting(false);
      setLocalStartError("The quiz could not start. Check the setup and try again.");
    }
  };

  return (
    <section
      className={"mcq-game-select-shell" + (isModal ? " mcq-game-select-shell--modal" : "")}
      aria-label="Choose a quiz game"
      data-testid="mcq-game-selector"
    >
      <div
        className={isModal ? "mcq-game-select-dialog" : "mcq-game-select-page"}
        role={isModal ? "dialog" : undefined}
        aria-modal={isModal ? true : undefined}
        aria-labelledby={isModal ? "mcq-game-select-title" : undefined}
      >
        <header className={"mcq-game-select-topbar" + (isModal ? " mcq-game-select-topbar--modal" : "")}>
          {isModal ? (
            <>
              <span className="mcq-game-select-kicker">MATH ARCADE</span>
              <button
                type="button"
                className="mcq-game-select-close"
                onClick={onBack}
                aria-label="Cancel game selection"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </header>

        <main className={"mcq-game-select-content" + (isModal ? " mcq-game-select-content--modal" : "")}>
          <div className="mcq-game-select-intro">
            <span className="mcq-game-select-eyebrow">
              <Sparkles size={14} aria-hidden="true" />
              {isModal ? "SELECT ONE TO CONTINUE" : "PICK YOUR ADVENTURE"}
            </span>
            <h1 id={isModal ? "mcq-game-select-title" : undefined}>
              {isModal ? "Choose Your Game" : "Choose your game"}
            </h1>
            <p>{isModal ? "Select a game, then press Start Quiz." : "Same Math Quiz Engine. Four different ways to play."}</p>
          </div>

          <div className={"mcq-game-select-cards" + (isModal ? " mcq-game-select-cards--modal" : "")}>
            <button
              type="button"
              className={"mcq-game-select-card mcq-game-select-card--racing" + (selectedChoice === "car" ? " is-selected" : "")}
              onClick={() => chooseGame("car")}
              aria-label={GAME_OPTIONS[0].ariaLabel}
              aria-pressed={selectedChoice === "car"}
              data-testid="select-car-racing"
              disabled={starting}
            >
              <span className="mcq-game-select-art mcq-game-select-art--car" aria-hidden="true">
                <span className="mcq-game-select-sun" />
                <span className="mcq-game-select-road" />
                <span className="mcq-game-select-car"><CarFront size={49} strokeWidth={2.3} /></span>
                <span className="mcq-game-select-orb mcq-game-select-orb--one">7</span>
                <span className="mcq-game-select-orb mcq-game-select-orb--two">×</span>
              </span>
              <span className="mcq-game-select-card-copy">
                <span className="mcq-game-select-card-title">{GAME_OPTIONS[0].title}</span>
                <span className="mcq-game-select-card-description">{GAME_OPTIONS[0].description}</span>
                <span className="mcq-game-select-card-action">
                  {isModal ? (selectedChoice === "car" ? <><Check size={14} aria-hidden="true" /> Selected</> : GAME_OPTIONS[0].action) : "Play racing"}
                  {!isModal && <span aria-hidden="true">→</span>}
                </span>
              </span>
            </button>

            <button
              type="button"
              className={"mcq-game-select-card mcq-game-select-card--jump" + (selectedChoice === "jump" ? " is-selected" : "")}
              onClick={() => chooseGame("jump")}
              aria-label={GAME_OPTIONS[1].ariaLabel}
              aria-pressed={selectedChoice === "jump"}
              data-testid="select-jump-adventure"
              disabled={starting}
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
                <span className="mcq-game-select-card-title">{GAME_OPTIONS[1].title}</span>
                <span className="mcq-game-select-card-description">{GAME_OPTIONS[1].description}</span>
                <span className="mcq-game-select-card-action">
                  {isModal ? (selectedChoice === "jump" ? <><Check size={14} aria-hidden="true" /> Selected</> : GAME_OPTIONS[1].action) : "Start jumping"}
                  {!isModal && <span aria-hidden="true">→</span>}
                </span>
              </span>
            </button>

            <button
              type="button"
              className={"mcq-game-select-card mcq-game-select-card--shooter" + (selectedChoice === "shooter" ? " is-selected" : "")}
              onClick={() => chooseGame("shooter")}
              aria-label={GAME_OPTIONS[2].ariaLabel}
              aria-pressed={selectedChoice === "shooter"}
              data-testid="select-space-shooter"
              disabled={starting}
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
                <span className="mcq-game-select-card-title">{GAME_OPTIONS[2].title}</span>
                <span className="mcq-game-select-card-description">{GAME_OPTIONS[2].description}</span>
                <span className="mcq-game-select-card-action">
                  {isModal ? (selectedChoice === "shooter" ? <><Check size={14} aria-hidden="true" /> Selected</> : GAME_OPTIONS[2].action) : "Launch mission"}
                  {!isModal && <span aria-hidden="true">→</span>}
                </span>
              </span>
            </button>
            <button type="button"
              className={"mcq-game-select-card mcq-game-select-card--slice" + (selectedChoice === "slice" ? " is-selected" : "")}
              onClick={() => chooseGame("slice")} aria-label={GAME_OPTIONS[3].ariaLabel}
              aria-pressed={selectedChoice === "slice"} data-testid="select-math-slice-ninja" disabled={starting}>
              <span className="mcq-game-select-art mcq-game-select-art--slice" aria-hidden="true">
                <span className="mcq-slice-select-star mcq-slice-select-star--one">✦</span><span className="mcq-slice-select-star mcq-slice-select-star--two">✧</span>
                <span className="mcq-slice-select-orb mcq-slice-select-orb--one">12</span><span className="mcq-slice-select-orb mcq-slice-select-orb--two">8</span>
                <span className="mcq-slice-select-orb mcq-slice-select-orb--three">96</span><span className="mcq-slice-select-trail" />
                <span className="mcq-slice-select-blade"><Scissors size={39} strokeWidth={2.3}/></span>
              </span>
              <span className="mcq-game-select-card-copy"><span className="mcq-game-select-card-title">{GAME_OPTIONS[3].title}</span>
                <span className="mcq-game-select-card-description">{GAME_OPTIONS[3].description}</span>
                <span className="mcq-game-select-card-action">{isModal ? (selectedChoice === "slice" ? <><Check size={14} aria-hidden="true"/> Selected</> : GAME_OPTIONS[3].action) : "Swipe to slice"}{!isModal && <span aria-hidden="true">→</span>}</span>
              </span>
            </button>
          </div>

          {!isModal && (
            <p className="mcq-game-select-footnote">
              <Gamepad2 size={15} aria-hidden="true" />
              Start a new game or continue the active quiz with another game mode.
            </p>
          )}
          {isModal && (errorMessage || localStartError) && (
            <p className="mcq-game-select-error" role="alert">{errorMessage || localStartError}</p>
          )}
        </main>

        {isModal && (
          <footer className="mcq-game-select-actions">
            <button type="button" className="mcq-game-select-cancel" onClick={onBack} disabled={starting}>
              Cancel
            </button>
            <button
              type="button"
              className="mcq-game-select-start"
              onClick={startSelectedGame}
              disabled={!selectedChoice || !canStartQuiz || starting}
              data-testid="start-selected-game"
            >
              <Play size={16} fill="currentColor" aria-hidden="true" />
              <span>{starting ? "Starting…" : "Start Quiz"}</span>
            </button>
          </footer>
        )}
      </div>
    </section>
  );
};

export default GameModeSelector;
