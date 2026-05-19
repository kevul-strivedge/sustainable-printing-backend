import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const cybersource = require('cybersource-rest-client');

function getMerchantConfig() {
  return {
    authenticationType: 'http_signature',
    runEnvironment:     process.env.CYBERSOURCE_ENV        ?? 'apitest.cybersource.com',
    merchantID:         process.env.CYBERSOURCE_MERCHANT_ID,
    merchantKeyId:      process.env.CYBERSOURCE_API_KEY_ID,
    merchantsecretKey:  process.env.CYBERSOURCE_SECRET_KEY,
    logConfiguration:   { enableLog: false },
  };
}

/**
 * Charge a credit card via CyberSource REST API.
 * Mirrors the PHP ProcessPayment() function in docs/sustainable-master/ProcessPayment.php.
 *
 * @param {object} opts
 * @param {number} opts.amount        Total charge amount (AUD)
 * @param {object} opts.billing       { firstName, lastName, address, postcode, suburb, state, phone, email }
 * @param {object} opts.card          { number, cvv, expiryMonth, expiryYear }
 * @param {string|number} opts.referenceCode  Quote ID used as client reference
 * @returns {{ status: string, transactionId: string|null, errorMsg: string|null, errorBody: string|null }}
 */
export async function chargeCard({ amount, billing, card, referenceCode }) {
  const configObj = getMerchantConfig();

  if (!configObj.merchantID || !configObj.merchantKeyId || !configObj.merchantsecretKey) {
    throw new Error(
      'CyberSource credentials are not configured. ' +
      'Ensure CYBERSOURCE_MERCHANT_ID, CYBERSOURCE_API_KEY_ID, and CYBERSOURCE_SECRET_KEY are set in backend/.env and the server has been restarted.'
    );
  }
  const apiClient  = new cybersource.ApiClient();
  const paymentsApi = new cybersource.PaymentsApi(configObj, apiClient);

  // CyberSource Node SDK constructors do not accept plain-object arguments —
  // properties must be assigned directly after instantiation.
  const clientReferenceInfo = new cybersource.Ptsv2paymentsClientReferenceInformation();
  clientReferenceInfo.code = String(referenceCode);

  const processingInfo = new cybersource.Ptsv2paymentsProcessingInformation();
  processingInfo.capture           = true;
  processingInfo.commerceIndicator = 'internet';

  const amountDetails = new cybersource.Ptsv2paymentsOrderInformationAmountDetails();
  amountDetails.totalAmount = Number(amount).toFixed(2);
  amountDetails.currency    = 'AUD';

  const billTo = new cybersource.Ptsv2paymentsOrderInformationBillTo();
  billTo.firstName          = billing.firstName  ?? '';
  billTo.lastName           = billing.lastName   ?? '';
  billTo.address1           = billing.address    ?? '';
  billTo.postalCode         = billing.postcode   ?? '';
  billTo.locality           = billing.suburb     ?? '';
  billTo.administrativeArea = billing.state      ?? '';
  billTo.country            = 'AU';
  billTo.phoneNumber        = billing.phone      ?? '';
  billTo.email              = billing.email      ?? '';

  const orderInfo = new cybersource.Ptsv2paymentsOrderInformation();
  orderInfo.amountDetails = amountDetails;
  orderInfo.billTo        = billTo;

  const cardInfo = new cybersource.Ptsv2paymentsPaymentInformationCard();
  cardInfo.number          = card.number;
  cardInfo.securityCode    = card.cvv;
  cardInfo.expirationMonth = card.expiryMonth;
  cardInfo.expirationYear  = card.expiryYear;

  const paymentInfo = new cybersource.Ptsv2paymentsPaymentInformation();
  paymentInfo.card = cardInfo;

  const request = new cybersource.CreatePaymentRequest();
  request.clientReferenceInformation = clientReferenceInfo;
  request.processingInformation      = processingInfo;
  request.orderInformation           = orderInfo;
  request.paymentInformation         = paymentInfo;

  return new Promise((resolve) => {
    paymentsApi.createPayment(request, (error, data) => {
      // Log the raw response so we can see what CyberSource returns
      if (process.env.NODE_ENV !== 'production') {
        console.log('[CyberSource] status:', error?.status ?? 'ok');
        console.log('[CyberSource] response.text:', error?.response?.text);
        console.log('[CyberSource] data:', JSON.stringify(data));
      }

      // AUTHORIZED — payment succeeded
      if (!error && data?.status === 'AUTHORIZED') {
        return resolve({ status: 'AUTHORIZED', transactionId: data.id, errorMsg: null, errorBody: null });
      }

      // All other paths are failures: HTTP errors (Axios throws for 4xx/5xx) or
      // non-AUTHORIZED statuses (DECLINED, INVALID_REQUEST, etc.) returned as data.
      let errorMsg  = 'Your card was declined. Please check the details and try again.';
      let errorBody = '';

      try {
        // The SDK's translateError() serialises the CyberSource body into error.response.text
        // (not .data / .body). Fall through several candidate properties so we always find it.
        const httpBody = error?.response?.text ?? error?.response?.data ?? error?.response?.body;
        // For non-AUTHORIZED 2xx the SDK passes data with the CyberSource error fields
        const csBody   = httpBody ?? data;

        if (csBody) {
          errorBody = typeof csBody === 'string' ? csBody : JSON.stringify(csBody);
          const parsed  = typeof csBody === 'string' ? JSON.parse(csBody) : csBody;
          errorMsg =
            parsed?.errorInformation?.message ??
            parsed?.message ??
            (error?.message && !error.message.startsWith('Request failed') ? error.message : null) ??
            errorMsg;
        }
      } catch { /* keep default errorMsg */ }

      resolve({
        status:        data?.status ?? 'DECLINED',
        transactionId: null,
        errorMsg,
        errorBody,
      });
    });
  });
}
