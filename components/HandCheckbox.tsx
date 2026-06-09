type HandCheckboxProps = {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
};

export default function HandCheckbox({ checked, disabled, onChange, label }: HandCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={[
        "group relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center",
        "transition-transform duration-150 active:scale-95",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:scale-105"
      ].join(" ")}
    >
      <svg
        viewBox="0 0 28 28"
        className="h-7 w-7 drop-shadow-sm"
        aria-hidden="true"
      >
        <path
          d="M4 6 C4 3, 6 2, 8 3 L22 4 C25 4, 26 6, 25 9 L24 22 C24 25, 22 26, 19 25 L6 24 C3 24, 2 22, 3 19 Z"
          fill={checked ? "#fef9c3" : "#fffef8"}
          stroke="#5c4033"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {checked ? (
          <path
            d="M8 14 L12 18 L21 9"
            fill="none"
            stroke="#b45309"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </svg>
    </button>
  );
}
