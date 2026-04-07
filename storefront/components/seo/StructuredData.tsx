interface StructuredDataProps {
  id?: string;
  data: Record<string, unknown> | Array<Record<string, unknown>>;
}

export function StructuredData({ id, data }: StructuredDataProps) {
  return (
    <script
      {...(id ? { id } : {})}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}