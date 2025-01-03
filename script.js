// Dark & light mode start
let icon = document.getElementById("icon");

// Check if there's a saved preference in localStorage
let islightTheme = localStorage.getItem("colorMode") === "light";

// Dark & light mode main function
icon.onclick = function () {
    document.body.classList.toggle("lightTheme");
    if (document.body.classList.contains("lightTheme")) {
        icon.src = "svg/moon.png";
        iconCart.src = "svg/shoppingCartDark.png";
        localStorage.setItem("colorMode", "light");
    } else {
        icon.src = "svg/sun.png";
        iconCart.src = "svg/shoppingCartWhite.png";
        localStorage.setItem("colorMode", "dark");
    }
}


// Dark & light mode for scrollbar
const scrollbarTheme = document.getElementById("icon");
let isDark = true;

scrollbarTheme.addEventListener("click", () => {
    // Remove scrollbar
    document.documentElement.style.overflow = "hidden";
    // Trigger reflow to apply overflow style
    document.body.clientWidth;
    // Change scheme
    document.documentElement.setAttribute(
        "data-color-scheme",
        isDark ? "light" : "dark"
    );
    // Remove overflow style to bring back the scrollbar with the correct scheme 
    document.documentElement.style.overflow = "";

    isDark = !isDark;
});


// Slider
const initSlider = () => {
    const imageList = document.querySelector(".sliderWrapper .imageList");
    const buttonSlide = document.querySelectorAll(".sliderWrapper .sliderButton");
    const sliderScrollbar = document.querySelector(".containerSlider .sliderScrollbar");
    const scrollbarThumb = sliderScrollbar.querySelector(".scrollbarThumb")
    const maxScrollLeft = imageList.scrollWidth - imageList.clientWidth;

    // Scrollbar thumb dragging
    scrollbarThumb.addEventListener("mousedown", (e) => {
        const starx = e.clientX;
        const thumbPosition = scrollbarThumb.offsetLeft;

        // Thumb position being updated on mouse move
        const handleMouseMove = (e) => {
            const deltax = e.clientX - starx;
            const newThumbPosition = thumbPosition + deltax;
            const maxThumbPosition = sliderScrollbar.getBoundingClientRect().width - scrollbarThumb.offsetWidth;

            const boundedPosition = Math.max(0, Math.min(maxThumbPosition, newThumbPosition));
            const scrollPosition = (boundedPosition / maxThumbPosition) * maxScrollLeft;

            scrollbarThumb.style.left = `${boundedPosition}px`;
            imageList.scrollLeft = scrollPosition;
        }
        // Remove event listener on mouse up
        const handleMouseUp = () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp)
        }

        // Event listeners for dragging interaction
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp)
    })

    // Slide images changing due to clicking buttons
    buttonSlide.forEach(button => {
        button.addEventListener("click", () => {
            const direction = button.id === "previousSlide" ? -1 : 1;
            const scrollAmount = imageList.clientWidth * direction;
            imageList.scrollBy({ left: scrollAmount, behavior: "smooth" })
        });
    });

    const handlebuttonSlide = () => {
        buttonSlide[0].style.display = imageList.scrollLeft <= 0 ? "none" : "block";
        buttonSlide[1].style.display = imageList.scrollLeft >= maxScrollLeft ? "none" : "block";
    }

    const updateScrollThumbPosition = () => {
        const scrollPosition = imageList.scrollLeft;
        const thumbPosition = (scrollPosition / maxScrollLeft) * (sliderScrollbar.clientWidth - scrollbarThumb.offsetWidth);
        scrollbarThumb.style.left = `${thumbPosition}px`;

    }

    imageList.addEventListener("scroll", () => {
        handlebuttonSlide();
        updateScrollThumbPosition();
    });
}

window.addEventListener("load", initSlider)


//Shopping cart
const cart = [];
const cartItemsElement = document.getElementById('cartItems');
const totalPriceElement = document.getElementById('totalPrice');
const cartElement = document.getElementById('cart');
const iconCart = document.getElementById('iconCart');
const checkoutButton = document.getElementById('checkoutButton');

document.querySelectorAll('.addToCart').forEach(button => {
    button.addEventListener('click', () => {
        const product = button.getAttribute('data-product');
        const price = parseFloat(button.getAttribute('data-price'));

        cart.push({ product, price });
        updateCart();
        cartElement.style.display = 'block'; // Automatically show the cart
    });
});

iconCart.addEventListener('click', () => {
    if (cartElement.style.display === 'none' || cartElement.style.display === '') {
        cartElement.style.display = 'block';
    } else {
        cartElement.style.display = 'none';
    }
});

checkoutButton.addEventListener('click', () => {
    if (cart.length > 0) {
        alert(`You have successfully checked out. Total amount: ${totalPriceElement.textContent}$`);
        cart.length = 0; // Clear the cart
        updateCart();
        cartElement.style.display = 'none';
    }
});

function updateCart() {
    cartItemsElement.innerHTML = '';
    let totalPrice = 0;

    cart.forEach(item => {
        const li = document.createElement('li');
        li.textContent = `${item.product} - ${item.price}$`;
        cartItemsElement.appendChild(li);
        totalPrice += item.price;
    });

    totalPriceElement.textContent = totalPrice.toFixed(2);

    // Disable checkout button if the cart is empty (equal to 0)
    if (totalPrice === 0) {
        checkoutButton.disabled = true;
    } else {
        checkoutButton.disabled = false;
    }
}


// Sleep function
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Scroll top
function topFunction() {
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


// Scroll bottom
function bottomFunction() {
    window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth"
    });
}


// Random number generator set with default value 8
function randomN() {
    const maxNumber = document.getElementById("maxNum").value || 8;
    const randomNumber = Math.floor(Math.random() * maxNumber) + 1;

    document.getElementById("rng").innerHTML = randomNumber;
}


// Open images in new window functions
function imageOpen1() {
    window.open("images/slider/witcher3-1.png");
}
function imageOpen2() {
    window.open("images/slider/witcher3-2.png");
}
function imageOpen3() {
    window.open("images/slider/witcher3-3.png");
}
function imageOpen4() {
    window.open("images/slider/witcher-4.jpg");
}
function imageOpen5() {
    window.open("images/slider/cyberpunk-1.jpg");
}
function imageOpen6() {
    window.open("images/slider/cyberpunk-2.jpg");
}
function imageOpen7() {
    window.open("images/slider/cyberpunk-3.jpg");
}
function imageOpen8() {
    window.open("images/slider/cyberpunk-4.jpg");
}
function imageOpen9() {
    window.open("images/slider/dishonored-1.jpg");
}
function imageOpen10() {
    window.open("images/slider/dishonored-2.jpg");
}
function imageOpen11() {
    window.open("images/slider/got-1.jpg");
}
function imageOpen12() {
    window.open("images/slider/got-2.jpg");
}
function imageOpen13() {
    window.open("images/slider/gow-rag-1.jpg");
}
function imageOpen14() {
    window.open("images/slider/gow-rag-2.png");
}
function imageOpen15() {
    window.open("images/slider/Sekiro-1.jpg");
}
function imageOpen16() {
    window.open("images/slider/hogwarts-1.png");
}
function imageOpen17() {
    window.open("images/slider/elden-1.jpg");
}
function imageOpen18() {
    window.open("images/slider/lis-1.jpg");
}