function getISTDateKey() {
  const now = new Date();

  // convert to IST
  const ist = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  // before 7am -> belongs to previous day
  if (ist.getHours() < 7) {
    ist.setDate(ist.getDate() - 1);
  }

  return ist.toISOString().split("T")[0];
}

function getNextDateKey(currentDateKey) {
  const date = new Date(currentDateKey);
  date.setDate(date.getDate() + 1);
  return date.toISOString().split("T")[0];
}

module.exports = { getISTDateKey, getNextDateKey };
