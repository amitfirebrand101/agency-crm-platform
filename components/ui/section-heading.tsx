type SectionHeadingProps = {
  title: string;
  description?: string;
};

export function SectionHeading({ title, description }: SectionHeadingProps) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-semibold">{title}</h2>
      {description ? <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p> : null}
    </div>
  );
}
