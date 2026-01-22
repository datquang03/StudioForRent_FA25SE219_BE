import asyncHandler from 'express-async-handler';
import {
  createReport,
  getReports,
  getMyReports,
  getReportById,
  updateReport,
  deleteReport
} from '../services/report.service.js';

export const createReportController = asyncHandler(async (req, res) => {
  const reportData = {
    ...req.body,
    reporterId: req.user._id
  };
  const report = await createReport(reportData);
  res.status(201).json({ success: true, data: report });
});

export const getReportsController = asyncHandler(async (req, res) => {
  const reports = await getReports(req.query);
  res.status(200).json({ success: true, data: reports });
});

export const getMyReportsController = asyncHandler(async (req, res) => {
  const reports = await getMyReports(req.user._id, req.query);
  res.status(200).json({ success: true, data: reports });
});

export const getReportByIdController = asyncHandler(async (req, res) => {
  const report = await getReportById(req.params.id, req.user);
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
