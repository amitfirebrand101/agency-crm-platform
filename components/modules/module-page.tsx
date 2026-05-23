import type { LucideIcon } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

type ModulePageProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  items: string[];
};

export function ModulePage({ title, description, icon: Icon, items }: ModulePageProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">{description}</p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Production module plan</h2>
        </CardHeader>
        <CardBody>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <div className="rounded-md border border-border bg-background p-4 text-sm font-medium" key={item}>
                {item}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
