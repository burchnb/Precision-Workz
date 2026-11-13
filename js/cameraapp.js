import { GoogleGenAI, Type } from "https://esm.sh/@google/genai";
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
        
        // Advanced: Check if the device hardware supports software zoom configuration
        setTimeout(() => {
            videoTrack = stream.getVideoTracks()[0];
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

function cameraShutter(){
    setTimeout(function(){
    document.getElementById("camera-container").style.opacity = 0;

    }, 150);
    setTimeout(function(){
        document.getElementById("camera-container").style.opacity = 100;

    },250)
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
    //runOCR(optimizedDataUrl);
    runGemini(optimizedDataUrl);
}





    async function runGemini(file){
     const captureButton = document.getElementById('capture-btn');
        const apiKey = "AQ.Ab8RN6KxpNYiTAXpbQKneZ5oJ84sZkPB7wvurLHw6PZeWhQN6Q";

const ai = new GoogleGenAI({apiKey});
captureBtn.disabled = true;
captureBtn.classList.add("disabled-btn");
captureBtn.innerText = "Please wait...";
      statusText.textContent = "Scanning receipt...";

      try {
 
        const base64Data = file.split(",")[1];//await fileToBase64(file);

        // Enforce strict JSON output structure
        const receiptSchema = {
          type: Type.OBJECT,
          properties: {
            vendor: { type: Type.STRING, description: "Store or merchant name" },
            date: { type: Type.STRING, description: "YYYY-MM-DD format if visible" },
            total: { type: Type.NUMBER, description: "Final total paid" },
            tax: { type: Type.NUMBER, description: "Total tax amount" },
            category: {
              type: Type.STRING,
              enum: [
                "Fuel",
                "Maintenance",
                "Equipment",
                "Lodging",
                "Food",
                "Other"
              ]
            },
            description: { type: Type.STRING, description: "Name of item and how many units of each item" },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  name: { type: Type.STRING },
                  price: { type: Type.NUMBER },
                  quantity: { type: Type.NUMBER }
                },
                required: ["description", "name", "price"]
              }
            }
          },
          required: ["date","vendor", "total", "items", "description"]
        };
console.log('generatecontent');
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash-lite",
          contents: [
            {
              inlineData: {
                data: base64Data,
                mimeType: "image/png"
              }
            },
            "Extract the receipt details. Never invent items not visible on the receipt; skip unreadable lines."
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: receiptSchema
          }
        });

        // Parse and display formatted JSON
        const parsedData = JSON.parse(response.text);
        resultText.textContent = JSON.stringify(parsedData, null, 2);

        alert(resultText.textContent);
        statusText.textContent = "Ready";
        captureButton.disabled = false;
        captureButton.classList.remove("disabled-btn");
        captureButton.innerText = "Capture Photo";
      } catch (err) {
        resultText.textContent = "Error: " + err.message;
        captureButton.disabled = false;
        captureButton.classList.remove("disabled-btn");
        captureButton.innerText = "Capture Photo";
      }
    }


// Event Listeners
captureBtn.addEventListener('click', function(e){
    cameraShutter();
    captureImage();
});

// Automatically start webcam when page loads
window.addEventListener('load', initWebcam);
    // Native browser event listener to block accidental tab closures
    window.addEventListener("beforeunload", (event) => {
        if(window.opener && !window.opener.closed){
            window.opener.postMessage(resultText.textContent, window.location.origin);
        }
        window.close();
    });