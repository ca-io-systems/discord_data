import { relations } from "drizzle-orm/relations";
import { clients, kbDocuments, kbChunks, riskRadar, queryBoard, csmResponseAnalytics, customerSentiment, dailyAnalyticsSummary, questions, topissuescomparisonJob, topIssues, looms, outboundLinks } from "./schema";

export const kbDocumentsRelations = relations(kbDocuments, ({one, many}) => ({
	client: one(clients, {
		fields: [kbDocuments.channelId],
		references: [clients.channelId]
	}),
	kbChunks: many(kbChunks),
}));

export const clientsRelations = relations(clients, ({many}) => ({
	kbDocuments: many(kbDocuments),
	riskRadars: many(riskRadar),
	csmResponseAnalytics: many(csmResponseAnalytics),
	customerSentiments: many(customerSentiment),
	dailyAnalyticsSummaries: many(dailyAnalyticsSummary),
	questions: many(questions),
	topissuescomparisonJobs: many(topissuescomparisonJob),
	looms: many(looms),
	outboundLinks: many(outboundLinks),
}));

export const kbChunksRelations = relations(kbChunks, ({one}) => ({
	kbDocument: one(kbDocuments, {
		fields: [kbChunks.docId],
		references: [kbDocuments.docId]
	}),
}));

export const riskRadarRelations = relations(riskRadar, ({one}) => ({
	client: one(clients, {
		fields: [riskRadar.channelId],
		references: [clients.channelId]
	}),
}));

export const csmResponseAnalyticsRelations = relations(csmResponseAnalytics, ({one}) => ({
	queryBoard: one(queryBoard, {
		fields: [csmResponseAnalytics.queryId],
		references: [queryBoard.id]
	}),
	client: one(clients, {
		fields: [csmResponseAnalytics.channelId],
		references: [clients.channelId]
	}),
}));

export const queryBoardRelations = relations(queryBoard, ({many}) => ({
	csmResponseAnalytics: many(csmResponseAnalytics),
}));

export const customerSentimentRelations = relations(customerSentiment, ({one}) => ({
	client: one(clients, {
		fields: [customerSentiment.channelId],
		references: [clients.channelId]
	}),
}));

export const dailyAnalyticsSummaryRelations = relations(dailyAnalyticsSummary, ({one}) => ({
	client: one(clients, {
		fields: [dailyAnalyticsSummary.channelId],
		references: [clients.channelId]
	}),
}));

export const questionsRelations = relations(questions, ({one, many}) => ({
	client: one(clients, {
		fields: [questions.channelId],
		references: [clients.channelId]
	}),
	topissuescomparisonJobs: many(topissuescomparisonJob),
	looms: many(looms),
	outboundLinks: many(outboundLinks),
}));

export const topissuescomparisonJobRelations = relations(topissuescomparisonJob, ({one}) => ({
	question: one(questions, {
		fields: [topissuescomparisonJob.questionId],
		references: [questions.id]
	}),
	client: one(clients, {
		fields: [topissuescomparisonJob.channelId],
		references: [clients.channelId]
	}),
	topIssue: one(topIssues, {
		fields: [topissuescomparisonJob.issueId],
		references: [topIssues.id]
	}),
}));

export const topIssuesRelations = relations(topIssues, ({many}) => ({
	topissuescomparisonJobs: many(topissuescomparisonJob),
	outboundLinks: many(outboundLinks),
}));

export const loomsRelations = relations(looms, ({one}) => ({
	question: one(questions, {
		fields: [looms.questionId],
		references: [questions.id]
	}),
	client: one(clients, {
		fields: [looms.channelId],
		references: [clients.channelId]
	}),
}));

export const outboundLinksRelations = relations(outboundLinks, ({one}) => ({
	topIssue: one(topIssues, {
		fields: [outboundLinks.issueId],
		references: [topIssues.id]
	}),
	question: one(questions, {
		fields: [outboundLinks.questionId],
		references: [questions.id]
	}),
	client: one(clients, {
		fields: [outboundLinks.channelId],
		references: [clients.channelId]
	}),
}));