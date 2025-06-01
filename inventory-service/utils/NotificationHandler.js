const notificationService = require('../lib/notification-manager');
const Inventory = require('../models/Inventory');
// const logger = require('../utils/logger');

class NotificationHandler {
  constructor() {
    this.notificationService = notificationService;
  }

  async initialize() {
    try {
      await this.notificationService.getInstance().connect();

      // Register handler for order.reprocess event
      this.notificationService.getInstance().registerHandler('order.reprocess', (notification) => {
        console.info(`Order repoc notification received:`, notification?.data?.metadata);
        const metadata = notification?.data?.metadata;
        console.log(metadata,'metadata');
        if (metadata) {
          console.info('Processing order repoc notification:', metadata?.order?.products);
          try {
            if(metadata?.events.indexOf('inventory-update-failed') !== -1) {
              updateInventory(metadata?.order?.products);
            }

          } catch (error) {
            console.error('Error processing order repoc notification:', error);
          }

        }
      });

      await this.notificationService.getInstance().startListening();
    } catch (error) {
      console.error('Error in handling notifications:', error);
    }

    return this.notificationService;
  }
}

async function updateInventory(products) {
  if (!Array.isArray(products) || products.length === 0) {
    console.warn('updateMultipleProductQuantities: Invalid request format - products array is required');
    return;
  }

  console.log('updateMultipleProductQuantities: Reducing quantities for multiple products', { data: products });

  const updateResults = [];
  const errors = [];

  // Process each product update
  for (const product of products) {
    const { productId, quantity } = product;

    if (!productId || quantity === undefined) {
      errors.push(`Invalid data for product: ${JSON.stringify(product)}`);
      continue;
    }

    try {
      // First find the current inventory
      const currentInventory = await Inventory.findOne({ productId: productId });

      if (!currentInventory) {
        errors.push(`Inventory not found for product ID: ${productId}`);
        continue;
      }

      // Calculate new quantity by reducing the requested amount
      const newQuantity = currentInventory.quantity - quantity;

      // Prevent negative inventory if needed
      if (newQuantity < 0) {
        errors.push(`Insufficient inventory for product ID: ${productId}. Requested: ${quantity}, Available: ${currentInventory.quantity}`);
        continue;
      }

      // Update with the reduced quantity
      const updatedInventory = await Inventory.findOneAndUpdate(
        { productId: productId },
        { quantity: newQuantity },
        { new: true, runValidators: true }
      );

      updateResults.push(updatedInventory);

    } catch (error) {
      console.error(`updateMultipleProductQuantities: Error updating product ID ${productId} - ${error.message}`, { error });
      errors.push(`Error updating product ID ${productId}: ${error.message}`);
    }
  }
}

module.exports = NotificationHandler;