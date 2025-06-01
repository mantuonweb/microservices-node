const { fork } = require('child_process');
const path = require('path');
const mongoClient = require('../utils/MongoConnectionClient');
const transactionProcessor = require('../services/transaction-processor');

// Start the scheduler
function startScheduler() {
    console.log('Starting transaction scheduler (30 min interval)');

    // Run immediately on start
    runScheduledTask();

    // Schedule to run every 2 minutes
    setInterval(runScheduledTask, 2 * 60 * 1000);
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
        
        process.send('Starting transaction processing');
        
        // Use the transaction processor service
        const stats = await transactionProcessor.getInstance().processPendingTransactions();
        
        process.send(`Processing completed: ${stats.processed} transactions processed, ${stats.completed} completed, ${stats.failed} failed`);
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