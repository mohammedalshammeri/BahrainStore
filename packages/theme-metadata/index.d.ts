export type SharedFieldType = "text" | "textarea" | "color" | "number" | "select" | "toggle" | "url";

export interface SharedFieldOption {
  label: string;
  value: string;
}

export interface SharedFieldMeta {
  key: string;
  label: string;
  type: SharedFieldType;
  defaultValue?: unknown;
  placeholder?: string;
  options?: SharedFieldOption[];
}

export interface SharedSectionMeta {
  type: string;
  label: string;
  labelAr: string;
  description: string;
  category: "structure" | "content" | "commerce" | "marketing";
  supportsBlocks: boolean;
  allowedBlocks: string[];
  fields: SharedFieldMeta[];
}

export interface SharedBlockMeta {
  type: string;
  label: string;
  labelAr: string;
  fields: SharedFieldMeta[];
}

export declare const sharedSectionMetadata: Record<string, SharedSectionMeta>;
export declare const sharedBlockMetadata: Record<string, SharedBlockMeta>;