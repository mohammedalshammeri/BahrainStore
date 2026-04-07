import type { ThemeBlockType, ThemeSectionType } from "./schema";
import {
  sharedBlockMetadata,
  sharedSectionMetadata,
  type SharedBlockMeta,
  type SharedFieldMeta,
  type SharedSectionMeta,
} from "./shared-theme-metadata";

export interface BuilderFieldMeta extends SharedFieldMeta {}

export interface BuilderSectionMeta extends Omit<SharedSectionMeta, "type" | "allowedBlocks"> {
  type: ThemeSectionType;
  allowedBlocks: ThemeBlockType[];
}

export interface BuilderBlockMeta extends Omit<SharedBlockMeta, "type"> {
  type: ThemeBlockType;
}

export const sectionMetadataRegistry = sharedSectionMetadata as unknown as Record<ThemeSectionType, BuilderSectionMeta>;
export const blockMetadataRegistry = sharedBlockMetadata as unknown as Record<ThemeBlockType, BuilderBlockMeta>;