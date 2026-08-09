function generateInstallments(type, totalInstallments, startDate) {
    let schedules = [];

    for (let i = 1; i <= totalInstallments; i++) {
        let dueDate = new Date(startDate);

        if (type === "MONTHLY") {
            dueDate.setMonth(dueDate.getMonth() + (i - 1));
        }

        if (type === "WEEKLY") {
            dueDate.setDate(dueDate.getDate() + ((i - 1) * 7));
        }

        if (type === "DAILY") {
            dueDate.setDate(dueDate.getDate() + (i - 1));
        }

        schedules.push({
            installment_number: i,
            due_date: dueDate
        });
    }

    return schedules;
}

module.exports = { generateInstallments };