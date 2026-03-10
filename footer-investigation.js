// JavaScript Console Script to Identify Footer Text Elements
// Copy and paste this into your browser's console on the problematic page

console.log('🔍 Starting Footer Text Investigation...');

// 1. Find all fb-address-information elements
const addressInfoElements = document.querySelectorAll('#fb-address-information, .fb-address-information');
console.log('📍 Found fb-address-information elements:', addressInfoElements.length);

addressInfoElements.forEach((element, index) => {
    console.log(`\n--- Element ${index + 1} ---`);
    console.log('ID:', element.id);
    console.log('Classes:', element.className);
    console.log('Visible:', element.offsetHeight > 0);
    console.log('Display style:', window.getComputedStyle(element).display);
    console.log('Position:', element.getBoundingClientRect());
    
    // Check if it has text content
    const textContent = element.textContent.trim();
    if (textContent) {
        console.log('Text content:', textContent.substring(0, 100) + (textContent.length > 100 ? '...' : ''));
    }
    
    // Check parent elements
    let parent = element.parentElement;
    let level = 0;
    while (parent && level < 5) {
        console.log(`Parent ${level}:`, parent.tagName, parent.id, parent.className);
        parent = parent.parentElement;
        level++;
    }
});

// 2. Find all delivery-type-entry elements
const deliveryTypeElements = document.querySelectorAll('#delivery-type-entry, .delivery-type-content');
console.log('\n🚚 Found delivery-type elements:', deliveryTypeElements.length);

deliveryTypeElements.forEach((element, index) => {
    console.log(`\n--- Delivery Element ${index + 1} ---`);
    console.log('ID:', element.id);
    console.log('Classes:', element.className);
    console.log('Visible:', element.offsetHeight > 0);
    console.log('Text:', element.textContent.trim());
});

// 3. Check for empty address elements that should be hidden
const emptyElements = Array.from(document.querySelectorAll('.fb-address-entry')).filter(el => {
    const text = el.textContent.trim();
    return !text || text === 'Tipo de Entrega' || text === 'Restaurant' || text === 'Your Location';
});

console.log('\n⚠️  Empty/Problematic elements that should be hidden:', emptyElements.length);
emptyElements.forEach((element, index) => {
    console.log(`Empty element ${index + 1}:`, element.id, element.className);
});

// 4. Create a fix function
window.fixFooterText = function() {
    console.log('🔧 Applying footer text fix...');
    
    // Hide the main container if it's empty
    const mainContainer = document.getElementById('fb-address-information');
    if (mainContainer) {
        const hasContent = mainContainer.textContent.trim().length > 50; // More than just labels
        if (!hasContent) {
            mainContainer.style.display = 'none !important';
            console.log('✅ Hidden empty fb-address-information container');
        }
    }
    
    // Hide individual empty entries
    const emptyEntries = document.querySelectorAll('.fb-address-entry');
    emptyEntries.forEach(entry => {
        const addressEl = entry.querySelector('.address');
        if (addressEl && (!addressEl.textContent.trim() || addressEl.textContent.trim() === '')) {
            entry.style.display = 'none !important';
            console.log('✅ Hidden empty entry:', entry.id || entry.className);
        }
    });
    
    console.log('🎉 Footer text fix completed!');
};

// 5. Auto-fix option
window.autoFixFooter = function() {
    console.log('🤖 Auto-fixing footer text...');
    
    // Create a mutation observer to catch dynamically added elements
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(() => {
            window.fixFooterText();
        });
    });
    
    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Apply initial fix
    window.fixFooterText();
    
    console.log('🔄 Auto-fix enabled - will catch future additions');
};

console.log('\n🎯 Commands available:');
console.log('1. fixFooterText() - Apply one-time fix');
console.log('2. autoFixFooter() - Enable continuous auto-fix');
console.log('\n🚀 Run fixFooterText() now to apply the fix!');
