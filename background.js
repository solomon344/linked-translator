const DODO_PAYMENT_URL = 'https://checkout.dodopayments.com/buy/pdt_0NbeAioqYB9igUFkOHeOW?quantity=1'; // replace

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'openPayment') {
    chrome.tabs.create({ url: DODO_PAYMENT_URL });
  }

  if (msg.action === 'openVerify') {
    chrome.storage.local.set({ pendingVerify: true }, () => {
      if (chrome.action?.openPopup) {
        chrome.action.openPopup();
      }
    });
  }
});
