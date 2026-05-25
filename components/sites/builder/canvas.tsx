"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GripVertical, Trash2 } from "lucide-react";
import type { Block, Theme } from "@/lib/sites/schema";
import { BlockPreview } from "@/components/sites/builder/block-preview";

export function BuilderCanvas({
  blocks,
  theme,
  selectedId,
  onSelect,
  onBlocksChange,
  onDelete,
  onDuplicate,
}: {
  blocks: Block[];
  theme: Theme;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBlocksChange: (blocks: Block[]) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onBlocksChange(arrayMove(blocks, oldIndex, newIndex));
  }

  if (blocks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-10">
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="font-semibold">Your page is empty</p>
          <p className="mt-1 text-sm text-muted">Add a block from the library on the left to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl py-8">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-3">
            {blocks.map((block) => (
              <SortableBlock
                key={block.id}
                block={block}
                theme={theme}
                isSelected={selectedId === block.id}
                onSelect={() => onSelect(block.id)}
                onDelete={() => onDelete(block.id)}
                onDuplicate={() => onDuplicate(block.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableBlock({
  block,
  theme,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
}: {
  block: Block;
  theme: Theme;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`group relative rounded-lg border bg-panel shadow-soft transition ${
        isSelected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
      }`}
    >
      {/* Hover / selection toolbar */}
      <div
        className={`absolute -top-3 right-2 z-10 flex items-center gap-0.5 rounded-md border border-border bg-panel px-1 py-0.5 shadow-soft transition ${
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="flex size-6 cursor-grab items-center justify-center rounded text-muted hover:bg-background hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
          title="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          className="flex size-6 items-center justify-center rounded text-muted hover:bg-background hover:text-foreground"
          aria-label="Duplicate block"
          title="Duplicate"
        >
          <Copy size={13} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="flex size-6 items-center justify-center rounded text-muted hover:bg-red-50 hover:text-red-600"
          aria-label="Delete block"
          title="Delete"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="overflow-hidden rounded-lg">
        <BlockPreview block={block} theme={theme} />
      </div>
    </div>
  );
}
