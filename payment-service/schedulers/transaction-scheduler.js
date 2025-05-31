const { fork } = require('child_process');
const path = require('path');
const PaymentTransaction = require('../models/payment-transaction.model');
const mongoClient = require('../utils/MongoConnectionClient');
// Start the scheduler
function startScheduler() {
    console.log('Starting transaction scheduler (30 min interval)');

    // Run immediately on start
    runScheduledTask();

    // Schedule to run every 5 minutes
    setInterval(runScheduledTask, 5 * 60 * 1000);
}

// Run the scheduled task in a separate process
function runScheduledTask() {
    console.log(`Running scheduled task at ${new Date().toISOString()}`);

    const worker = fork(path.join(__dirname, 'transaction-scheduler.js'), ['worker']);

    worker.on('message', (message) => {
        console.log('Worker message:', message);
    });

    worker.on('error', (error) => {
        console.error('Worker error:', error);
    });

    worker.on('exit', (code) => {
        console.log(`Worker exited with code ${code}`);
    });
}

// Worker process function
async function workerProcess() {
    try {
        mongoClient.getInstance().connect();
        // Find pending transactions
        const pendingTransactions = await PaymentTransaction.find({
            $or: [
                { status: 'PROCESSING' },
                { hasDataSyncIssue: true }
            ]
        });

        process.send(`Processing ${pendingTransactions.length} transactions`);

        // Process each transaction
        for (const tx of pendingTransactions) {
            try {
                // Your transaction processing logic here

                // Update transaction status
                tx.retry.count += 1;
                tx.status = 'COMPLETED'; // or 'FAILED' based on your logic
                await tx.save();
            } catch (err) {
                // Increment retry count
                tx.retry.count += 1;
                tx.retry.lastAttemptAt = new Date();
                await tx.save();
            }
        }

        process.send('Processing completed');
    } catch (error) {
        process.send(`Error: ${error.message}`);
    }

    // Exit the process when done
    process.exit(0);
}

// Check if this is the main process or a worker
if (process.argv.includes('worker')) {
    // This is a worker process
    workerProcess();
} else {
    // This is the main process
    module.exports = { startScheduler };
}