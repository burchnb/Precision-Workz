const formatter = new Intl.NumberFormat("en-US", {
style: "currency",
currency: "USD",
minimumFractionDigits: 2,
maximumFractionDigits: 2,
useGrouping: "always"
});
document.addEventListener("DOMContentLoaded", function(){
    document.querySelectorAll(".lineprice").forEach(input => {
        input.addEventListener("focusout", calcTotal);
        input.addEventListener("input", calcTotal);
    });
    calcTotal();
});
function calcTotal(event) {
    const inputs = document.querySelectorAll(".lineprice");
    let total = 0;
    inputs.forEach(input => {
        const cleanedValue = input.value.replace(/[$,]+/g, '');
        const value = parseFloat(cleanedValue);
        if (!isNaN(value)) total += value;
    });
    if(event && event.type === 'focusout') {
        const currentVal = parseFloat(event.target.value.replace(/,/g, ""));
        if (!isNaN(currentVal)) event.target.value = formatter.format(currentVal);
    }
    document.getElementById("totalAmount").innerHTML = formatter.format(total);
}