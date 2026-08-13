import type { RunStatusResult } from "@verbatra/sdk";
import { z } from "zod";

export const REVIEW_QUEUE_METHOD = "review.queue";

export const reviewQueueParamsSchema = z.strictObject({});

export type ReviewQueueParams = z.infer<typeof reviewQueueParamsSchema>;

export type ReviewQueueResult = RunStatusResult;
