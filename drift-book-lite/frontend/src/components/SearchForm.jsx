import { useEffect, useState } from "react";
import clsx from "clsx";
import { TextInput } from "./Input.jsx";
import { PrimaryButton } from "./Button.jsx";

export function SearchForm({ initialValue = "", compact = false, onSubmit }) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(value.trim());
  }

  return (
    <form
      className={clsx(
        "rounded-[2rem] border border-stone-200/70 bg-white/85 p-3 shadow-[0_18px_60px_rgba(47,33,15,0.08)]",
        compact ? "flex flex-col gap-3 md:flex-row" : "mt-8"
      )}
      onSubmit={handleSubmit}
    >
      <div className="flex-1">
        <TextInput
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="搜索书名，例如：共产党宣言"
          className="border-0 bg-transparent px-3 py-3 text-base shadow-none focus:ring-0"
        />
      </div>
      <PrimaryButton type="submit" className={compact ? "md:min-w-32" : "w-full md:w-auto"}>
        搜索图书
      </PrimaryButton>
    </form>
  );
}
