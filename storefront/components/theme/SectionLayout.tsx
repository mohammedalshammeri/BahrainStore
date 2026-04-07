import React, { ReactNode } from "react";
import { ValidatedThemeSection } from "./schema";
import clsx from "clsx";

interface Props {
  children: ReactNode;
  section: ValidatedThemeSection;
  className?: string;
  id?: string;
}

export function SectionLayout({ children, section, className, id }: Props) {
  const settings = section.settings as Record<string, unknown>;
  const layout = section.layout;

  // Read visual properties from the builder settings
  const bgColor = typeof settings.backgroundColor === "string" ? settings.backgroundColor : layout?.background ?? "transparent";
  const paddingY = typeof settings.paddingY === "string" ? settings.paddingY : "py-16 md:py-24";
  const containerMaxWidth =
    layout?.container === "full"
      ? "max-w-none"
      : layout?.container === "fluid"
        ? "max-w-screen-2xl"
        : "max-w-7xl";
  const directionClass = layout?.direction === "row" ? "flex-row" : "flex-col";
  const gapClass = {
    none: "gap-0",
    xs: "gap-2",
    sm: "gap-4",
    md: "gap-6",
    lg: "gap-8",
    xl: "gap-10",
  }[layout?.gap ?? "md"];
  const alignClass = {
    start: "items-start",
    center: "items-center",
    end: "items-end",
    stretch: "items-stretch",
  }[layout?.align ?? "stretch"];
  const justifyClass = {
    start: "justify-start",
    center: "justify-center",
    end: "justify-end",
    between: "justify-between",
    around: "justify-around",
  }[layout?.justify ?? "start"];

  const style = {
    backgroundColor: bgColor !== "transparent" ? bgColor : undefined,
  };

  return (
    <section 
      id={id || section.id} 
      className={clsx("w-full relative overflow-hidden", paddingY, className)}
      style={style}
    >
      <div className={clsx("mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex", containerMaxWidth, directionClass, gapClass, alignClass, justifyClass)}>
        {children}
      </div>
    </section>
  );
}