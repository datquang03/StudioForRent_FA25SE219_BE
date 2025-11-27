import Report from '../models/Report/report.model.js';

export const createReport = async (data) => {
  try {
    const report = new Report(data);
    return await report.save();
  } catch (error) {
    console.error('Error creating report:', error);
    throw new Error('Failed to create report');
  }
};

export const getReports = async (filter = {}, options = {}) => {
  try {
    return await Report.find(filter, null, options)
      .populate('bookingId')
      .populate('reporterId', 'name email')
      .populate('resolvedBy', 'name email')
      .exec();
  } catch (error) {
    console.error('Error fetching reports:', error);
    throw new Error('Failed to fetch reports');
  }
};

export const getReportById = async (id) => {
  try {
    return await Report.findById(id)
      .populate('bookingId')
      .populate('reporterId', 'name email')
      .populate('resolvedBy', 'name email')
      .exec();
  } catch (error) {
    console.error(`Error fetching report with id ${id}:`, error);
    throw new Error('Failed to fetch report by id');
  }
};

export const updateReport = async (id, update) => {
  try {
    return await Report.findByIdAndUpdate(id, update, { new: true })
      .populate('bookingId')
      .populate('reporterId', 'name email')
      .populate('resolvedBy', 'name email')
      .exec();
  } catch (error) {
    console.error(`Error updating report with id ${id}:`, error);
    throw new Error('Failed to update report');
  }
};

export const deleteReport = async (id) => {
  try {
    return await Report.findByIdAndDelete(id);
  } catch (error) {
    console.error(`Error deleting report with id ${id}:`, error);
    throw new Error('Failed to delete report');
  }
};
