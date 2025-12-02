import asyncHandler from 'express-async-handler';
import {
  createReport,
  getReports,
  getReportById,
  updateReport,
  deleteReport
} from '../services/report.service.js';

export const createReportController = asyncHandler(async (req, res) => {
  const report = await createReport(req.body);
  res.status(201).json({ success: true, data: report });
});

export const getReportsController = asyncHandler(async (req, res) => {
  const reports = await getReports();
  res.status(200).json({ success: true, data: reports });
});

export const getReportByIdController = asyncHandler(async (req, res) => {
  const report = await getReportById(req.params.id);
  if (!report) {
    res.status(404);
    throw new Error('Báo cáo không tồn tại');
  }
  res.status(200).json({ success: true, data: report });
});

export const updateReportController = asyncHandler(async (req, res) => {
  const report = await updateReport(req.params.id, req.body);
  if (!report) {
    res.status(404);
    throw new Error('Báo cáo không tồn tại');
  }
  res.status(200).json({ success: true, data: report });
});

export const deleteReportController = asyncHandler(async (req, res) => {
  const report = await deleteReport(req.params.id);
  if (!report) {
    res.status(404);
    throw new Error('Báo cáo không tồn tại');
  }
  res.status(200).json({ success: true, message: 'Xóa báo cáo thành công' });
});
