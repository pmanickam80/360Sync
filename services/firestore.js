const { Firestore } = require('@google-cloud/firestore');

// Initialize Firestore
const firestore = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'servifyportal',
});

const firestoreService = {
  // Track user login
  async trackUserLogin(user) {
    try {
      const loginData = {
        email: user.email,
        name: user.name,
        picture: user.picture,
        timestamp: Firestore.Timestamp.now(),
        userAgent: user.userAgent || null,
        ipAddress: user.ipAddress || null
      };

      // Update user document
      await firestore.collection('users').doc(user.email).set({
        email: user.email,
        name: user.name,
        picture: user.picture,
        lastLogin: Firestore.Timestamp.now(),
        updatedAt: Firestore.Timestamp.now()
      }, { merge: true });

      // Add login event
      await firestore.collection('user_activity').add({
        ...loginData,
        action: 'login',
        type: 'authentication'
      });

      console.log('User login tracked:', user.email);
      return true;
    } catch (error) {
      console.error('Error tracking user login:', error);
      return false;
    }
  },

  // Track user logout
  async trackUserLogout(email) {
    try {
      await firestore.collection('user_activity').add({
        email,
        timestamp: Firestore.Timestamp.now(),
        action: 'logout',
        type: 'authentication'
      });

      console.log('User logout tracked:', email);
      return true;
    } catch (error) {
      console.error('Error tracking user logout:', error);
      return false;
    }
  },

  // Track any user action
  async trackAction(email, action, details = {}) {
    try {
      await firestore.collection('user_activity').add({
        email,
        action,
        details,
        timestamp: Firestore.Timestamp.now(),
        type: 'user_action'
      });

      console.log('User action tracked:', email, action);
      return true;
    } catch (error) {
      console.error('Error tracking user action:', error);
      return false;
    }
  },

  // Track report processing
  async trackReportProcessing(email, reportType, reportData) {
    try {
      const doc = await firestore.collection('report_processing').add({
        email,
        reportType,
        filename: reportData.filename || null,
        rowCount: reportData.rowCount || 0,
        timestamp: Firestore.Timestamp.now(),
        status: 'processed',
        metadata: reportData.metadata || {}
      });

      console.log('Report processing tracked:', doc.id);
      return doc.id;
    } catch (error) {
      console.error('Error tracking report processing:', error);
      return null;
    }
  },

  // Get user statistics
  async getUserStats() {
    try {
      const usersSnapshot = await firestore.collection('users').get();
      const users = usersSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));

      // Get activity count for each user in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const activitySnapshot = await firestore.collection('user_activity')
        .where('timestamp', '>=', Firestore.Timestamp.fromDate(thirtyDaysAgo))
        .get();

      const activityByUser = {};
      activitySnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!activityByUser[data.email]) {
          activityByUser[data.email] = 0;
        }
        activityByUser[data.email]++;
      });

      return {
        totalUsers: users.length,
        users: users.map(user => ({
          ...user,
          activityCount: activityByUser[user.email] || 0,
          lastLogin: user.lastLogin?.toDate?.() || null
        })),
        totalActivity: activitySnapshot.size
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return null;
    }
  },

  // Get recent activity
  async getRecentActivity(limit = 50) {
    try {
      const snapshot = await firestore.collection('user_activity')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || null
      }));
    } catch (error) {
      console.error('Error getting recent activity:', error);
      return [];
    }
  },

  // Get report processing statistics
  async getReportStats(days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const snapshot = await firestore.collection('report_processing')
        .where('timestamp', '>=', Firestore.Timestamp.fromDate(startDate))
        .get();

      const stats = {
        totalReports: snapshot.size,
        byType: {},
        byUser: {},
        totalRows: 0
      };

      snapshot.docs.forEach(doc => {
        const data = doc.data();

        // Count by type
        if (!stats.byType[data.reportType]) {
          stats.byType[data.reportType] = 0;
        }
        stats.byType[data.reportType]++;

        // Count by user
        if (!stats.byUser[data.email]) {
          stats.byUser[data.email] = 0;
        }
        stats.byUser[data.email]++;

        // Sum rows
        stats.totalRows += data.rowCount || 0;
      });

      return stats;
    } catch (error) {
      console.error('Error getting report stats:', error);
      return null;
    }
  },

  // Check if Firestore is available
  isAvailable() {
    try {
      // In production (Cloud Run/App Engine), credentials are automatic
      // In development, check if credentials are configured
      return process.env.NODE_ENV === 'production' ||
             process.env.GOOGLE_APPLICATION_CREDENTIALS ||
             process.env.GOOGLE_CLOUD_PROJECT;
    } catch (error) {
      return false;
    }
  }
};

module.exports = { firestoreService };
