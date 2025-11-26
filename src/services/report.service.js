import Report from '../models/Report/report.model.js';

export const createReport = async (data) => {
  const report = new Report(data);
  return await report.save();
};

export const getReports = async (filter = {}, options = {}) => {
  return await Report.find(filter, null, options)
    .populate('bookingId')
    .populate('reporterId', 'name email')
    .populate('resolvedBy', 'name email')
    .exec();
};

export const getReportById = async (id) => {
  return await Report.findById(id)
    .populate('bookingId')
    .populate('reporterId', 'name email')
    .populate('resolvedBy', 'name email')
    .exec();
};

export const updateReport = async (id, update) => {
  return await Report.findByIdAndUpdate(id, update, { new: true })
    .populate('bookingId')
    .populate('reporterId', 'name email')
    .populate('resolvedBy', 'name email')
    .exec();
};

export const deleteReport = async (id) => {
  return await Report.findByIdAndDelete(id);
};
