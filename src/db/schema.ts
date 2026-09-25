import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const watchlist = pgTable(
  "watchlist",
  {
    id: serial("id").primaryKey(),
    symbol: text("symbol").notNull(),
    label: text("label").notNull(),
    kind: text("kind").notNull().default("stock"),
    sort: integer("sort").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("watchlist_symbol_key").on(t.symbol)]
);

export const strategies = pgTable("strategies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  expiry: text("expiry").notNull(),
  legs: jsonb("legs").notNull(),
  thesis: text("thesis"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notes = pgTable("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  tags: jsonb("tags").notNull().default(sql`'[]'::jsonb`),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const briefs = pgTable(
  "briefs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    day: text("day").notNull(),
    kind: text("kind").notNull().default("daily"),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("briefs_day_kind_key").on(t.day, t.kind)]
);

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: text("session_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  cards: jsonb("cards"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WatchRow = typeof watchlist.$inferSelect;
export const schema = { watchlist, strategies, notes, briefs, chatMessages };
