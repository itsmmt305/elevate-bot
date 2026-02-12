function getISTDateKey() {
  const now = new Date();

  // convert to IST
  const ist = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  // before 5am -> belongs to previous day
  if (ist.getHours() < 5) {
    ist.setDate(ist.getDate() - 1);
  }

  return ist.toISOString().split("T")[0];
}

module.exports = { getISTDateKey };
