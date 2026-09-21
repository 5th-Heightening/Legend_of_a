// Independent of the game logic - just flips a class that the
// CSS variables in Legend_of_a.html's <style> key off of.
const themeToggle = document.getElementById("theme-toggle");

themeToggle.addEventListener("click", () => {

    const isLight =
        document.documentElement.classList.toggle("light-mode");

    themeToggle.textContent = isLight ? "Dark Mode" : "Light Mode";
});
