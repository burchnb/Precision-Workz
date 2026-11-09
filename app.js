const statusText = document.getElementById('ocr-status');
const resultText = document.getElementById('ocr-result');
const video = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('capture-btn');
const snapshotImg = document.getElementById('snapshot');

let videoTrack = null; // Store the video track globally to control zoom later

async function initWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 1920, min: 1280 }, 
                height: { ideal: 1080, min: 720 },
                aspectRatio: 1.777777778, // Forces 16:9 aspect ratio for a wider field of view
                facingMode: "environment"   // Pulls from the primary back camera lens
            }, 
            audio: false 
        });
        
        video.srcObject = stream;
        videoTrack = stream.getVideoTracks()[0];

        // Advanced: Check if the device hardware supports software zoom configuration
        setTimeout(() => {
            const capabilities = videoTrack.getCapabilities();
            if (capabilities.zoom) {
                console.log("Camera zoom supported. Range:", capabilities.zoom.min, "to", capabilities.zoom.max);
                // Force the lens to its absolute widest point (minimum zoom value)
                videoTrack.applyConstraints({ advanced: [{ zoom: capabilities.zoom.min }] });
            }
        }, 500);

    } catch (err) {
        console.error("Error accessing camera: ", err);
    }
}


function captureImage() {
    const context = canvas.getContext('2d');
    
    // 1. Match full resolution sizes
    const fullWidth = video.videoWidth;
    const fullHeight = video.videoHeight;
    
    // 2. Calculate the exact coordinates of our 70% width, 80% height central overlay box
    const cropWidth = fullWidth * 0.70;
    const cropHeight = fullHeight * 0.80;
    const cropX = (fullWidth - cropWidth) / 2;
    const cropY = (fullHeight - cropHeight) / 2;
    
    // Size canvas to only fit the cropped target region
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    
    // Apply contrast enhancers
    context.filter = 'grayscale(100%) contrast(150%) brightness(95%)';
    
    // 3. Draw ONLY the target box region from the video stream onto our canvas
    context.drawImage(
        video, 
        cropX, cropY, cropWidth, cropHeight, // Source box dimensions from the stream
        0, 0, cropWidth, cropHeight          // Destination layout inside the canvas
    );
    
    // Run the remaining binarization and Tesseract loops on this tightly cropped view!
    const optimizedDataUrl = canvas.toDataURL('image/png');
    snapshotImg.src = optimizedDataUrl;
    runOCR(optimizedDataUrl);
}



async function runOCR(imageSource) {
    statusText.innerText = "Processing image...";
    try {
        const result = await Tesseract.recognize(imageSource, 'eng');
        statusText.innerText = "Parsing Data...";
        
        // Feed text into parser
        const structuredReceipt = parseReceiptText(result.data.text);
        
        // Render JSON to your result block instead of raw text
        resultText.innerText = JSON.stringify(structuredReceipt, null, 2);
        statusText.innerText = "Done!";
    } catch (error) {
        statusText.innerText = "Error extracting data.";
    }
}


function parseReceiptText(rawText) {
    console.log("--- Raw OCR Output --- \n", rawText);
    
    // Clean up typical OCR noise or misread characters
    const textLines = rawText.split('\n').map(line => line.trim());
    
    let receiptData = {
        date: null,
        total: 0.00,
        lineItems: []
    };

    // 1. Regex to locate Dates (Matches formats like MM/DD/YYYY, DD-MM-YY, YYYY/MM/DD)
    const dateRegex = /\b(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})|(\d{4}[\/\.-]\d{1,2}[\/\.-]\d{1,2})\b/;
    
    // 2. Regex to look for pricing patterns (e.g., 4.99, 120.00, $14.50)
    const priceRegex = /\d+\.\d{2}/;

    // Iterate through lines to map values
    textLines.forEach(line => {
        // Check for Date
        if (!receiptData.date) {
            const dateMatch = line.match(dateRegex);
            if (dateMatch) receiptData.date = dateMatch[0];
        }

        // Parse line items and prices
        // Looks for a line containing text followed by a decimal price
        if (priceRegex.test(line)) {
            const priceMatch = line.match(priceRegex);
            const price = parseFloat(priceMatch[0]);
            
            // Clean up the text part of the item line
            const description = line.replace(priceMatch[0], '').replace(/[\$\s,:\-*]+/g, ' ').trim();
            
            if (description.length > 2) {
                receiptData.lineItems.push({ description, price });
            }
        }
    });

    // 3. Isolate the Grand Total
    // Receipt totals are tricky. We scan lines containing keyword indicators backward 
    // or take the maximum price found as a fallback constraint.
    const totalKeywords = ['TOTAL', 'GRAND TOTAL', 'NET', 'AMOUNT DUE', 'BALANCE', 'PAYMENT AMOUNT', 'SUBTOTAL'];
    let foundTotal = false;

    for (let i = textLines.length - 1; i >= 0; i--) {
        const lineUpper = textLines[i].toUpperCase();
        if (totalKeywords.some(keyword => lineUpper.includes(keyword)) && priceRegex.test(lineUpper)) {
            const totalMatch = lineUpper.match(priceRegex);
            receiptData.total = parseFloat(totalMatch[0]);
            foundTotal = true;
            break;
        }
    }

    // Fallback: If no explicit 'total' line keyword matched, grab the highest price found
    if (!foundTotal && receiptData.lineItems.length > 0) {
        const prices = receiptData.lineItems.map(item => item.price);
        receiptData.total = Math.max(...prices);
    }

    return receiptData;
}


// Event Listeners
captureBtn.addEventListener('click', captureImage);

// Automatically start webcam when page loads
window.addEventListener('load', initWebcam);