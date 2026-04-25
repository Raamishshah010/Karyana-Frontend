// Choose the appropriate SERVER_URL based on environment
// For local development
// export const SERVER_URL = "http://localhost:5000/api";
// export const SERVER_URL = "https://server-karyana-dev-git-feat-sal-cc2f5c-anonymous-zaibs-projects.vercel.app/";
// export const SERVER_URL = "https://karyana-server.vercel.app/api";

// For production (uncomment the appropriate one when deploying)
// export const SERVER_URL = "https://server-karyana-dev.vercel.app/api";
// export const SERVER_URL = "http://54.153.208.108/api";
// export const SERVER_URL = "http://52.65.114.218/api";
export const SERVER_URL = "https://primelinkdistribution.com/api";
// export const SERVER_URL = "https://www.primelinkdistribution.com/api";


export const calculateRating = (reviews = [], key = "rating") => {
  const res = 
    reviews.reduce((acc, current) => {
      return acc + current[key];
    }, 0) / reviews.length;
  return !Number.isNaN(res) ? res.toFixed(2) : "0";
};

export const ORDER_STATUSES = [
  "Placed",
  "Processed",
  "Delivered",
  "Completed",
  "Cancelled",
  "Satelment",
];

export const ROLES = [
  "admin",
  "coordinator",
  "warehouse-manager"
]
export const MARITAL_STATUSES = [
  "Single",
  "Married"
]
export const USER_STATUSES = [
  "Active",
  "InActive"
]

export const getDifferenceBWinDates = (date) => {
  const AD = new Date(date);
  const CD = new Date();
  const diff = Math.abs(AD.getTime() - CD.getTime());
  const diffDays = Math.ceil(diff / (1000 * 3600 * 24));
  return diffDays;
};
export const checkAuthError = (error) => {
  // eslint-disable-next-line eqeqeq
  if (error?.request?.status == 401) {
    sessionStorage.removeItem("karyana-admin");
    window.location.replace("/login");
  }
};

export const pricingPlans = ["Free", "Premium"];

export const formatDate = (date) => {
  const d = new Date(date);
  var year = d.getFullYear();
  var month = ('0' + (d.getMonth() + 1)).slice(-2); // Add leading zero if month is single digit
  var day = ('0' + d.getDate()).slice(-2); // Add leading zero if day is single digit
  return year + "-" + month + "-" + day;
}