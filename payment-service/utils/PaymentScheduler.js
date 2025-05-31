const cron = require('node-cron');
const mongoose = require('mongoose');
const logger = require('./logger');

/**
 * PaymentScheduler class for scheduling and processing payment-related tasks
 */
class PaymentScheduler {
    /**
     * Create a new PaymentScheduler
     * @param {Object} options - Configuration options
     * @param {string} options.collectionName - MongoDB collection to process
     * @param {string} options.cronExpression - Cron expression for scheduling (default: every hour)
     * @param {Function} options.processorFunction - Function to process each document
     */
    constructor(options) {
        this.collectionName = options.collectionName;
        this.cronExpression = options.cronExpression || '0 * * * *'; // Default: Run every hour
        this.processorFunction = options.processorFunction;
        this.isRunning = false;
        this.scheduledJobs = [];

        if (!this.collectionName) {
            throw new Error('Collection name is required for PaymentScheduler');
        }

        if (!this.processorFunction || typeof this.processorFunction !== 'function') {
            throw new Error('Processor function is required and must be a function');
        }
    }

    /**
     * Start the scheduler
     */
    start() {
        logger.info(`Starting scheduler for collection: ${this.collectionName}`);

        const job = cron.schedule(this.cronExpression, async () => {
            if (this.isRunning) {
                logger.warn(`Previous job for ${this.collectionName} still running, skipping this execution`);
                return;
            }

            this.isRunning = true;
            logger.info(`Running scheduled job for collection: ${this.collectionName}`);

            try {
                await this.processCollection();
                logger.info(`Completed scheduled job for collection: ${this.collectionName}`);
            } catch (error) {
                logger.error(`Error in scheduled job for ${this.collectionName}: ${error.message}`);
            } finally {
                this.isRunning = false;
            }
        });

        this.scheduledJobs.push(job);
        return this;
    }

    /**
     * Stop all scheduled jobs
     */
    stop() {
        logger.info(`Stopping scheduler for collection: ${this.collectionName}`);
        this.scheduledJobs.forEach(job => job.stop());
        this.scheduledJobs = [];
        return this;
    }

    /**
     * Process the collection data
     * @returns {Promise<void>}
     */
    async processCollection() {
        const collection = mongoose.connection.collection(this.collectionName);

        // Find documents that need processing (you can customize this query)
        const query = { status: "PROCESSING" };
        const batchSize = 100;

        let processedCount = 0;
        let errorCount = 0;

        try {
            // Process in batches to avoid memory issues with large collections
            const cursor = collection.find(query).limit(batchSize);

            while (await cursor.hasNext()) {
                const document = await cursor.next();

                try {
                    // Process the document using the provided processor function
                    await this.processorFunction(document);

                    // Mark as processed
                    await collection.updateOne(
                        { _id: document._id },
                        { $set: { processed: true } }
                    );

                    processedCount++;
                } catch (error) {
                    errorCount++;
                    logger.error(`Error processing document ${document._id}: ${error.message}`);
                }
            }

            logger.info(`Processed ${processedCount} documents from ${this.collectionName}, errors: ${errorCount}`);
        } catch (error) {
            logger.error(`Error accessing collection ${this.collectionName}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Run the processor immediately (outside of schedule)
     * @returns {Promise<void>}
     */
    async runNow() {
        if (this.isRunning) {
            logger.warn(`Job for ${this.collectionName} already running, cannot start another`);
            return;
        }

        this.isRunning = true;

        try {
            logger.info(`Manually running job for collection: ${this.collectionName}`);
            await this.processCollection();
            logger.info(`Completed manual job for collection: ${this.collectionName}`);
        } catch (error) {
            logger.error(`Error in manual job for ${this.collectionName}: ${error.message}`);
        } finally {
            this.isRunning = false;
        }
    }
}

module.exports = PaymentScheduler;