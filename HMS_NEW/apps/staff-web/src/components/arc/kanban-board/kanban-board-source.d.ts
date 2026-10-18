import type { ComponentType, ReactNode } from "react";
export type KanbanColumn = { id: string; name: string; limit?: number };
export type KanbanPerson = { id: string; name: string; avatar?: string };
export type KanbanCard = { id: string; displayId?: string; summary?: string; body?: ReactNode; title: string; column: string; assignee?: string; label?: string; due?: string; points?: number; description?: string; checklist?: { id: string; text: string; done: boolean }[] };
export interface KanbanBoardProps { columns: KanbanColumn[]; people: KanbanPerson[]; cards: KanbanCard[]; onCardsChange?: (cards: KanbanCard[]) => void; defaultGroupBy?: "status" | "assignee"; currentUser?: string; title?: string; className?: string; readOnly?: boolean; allowCreate?: boolean; allowGrouping?: boolean; onOpenCard?: (id: string) => void; onMoveRequest?: (id: string, column: string, assignee?: string) => void }
export declare const KanbanBoard: ComponentType<KanbanBoardProps>;
