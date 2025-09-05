const addAll = (element, content) => {
	for (let i = 0; i < content.length; i++) {
		const child = content[i]
		if (child === undefined || child === null) continue
		element.append(child)
	}
}

/**
 * Creates a new HTML element based on the provided selector and properties
 * @author Twaish
 * @param {string} selector - The selector for the element (e.g., 'div.my-class')
 * @param {Object} props - Optional properties to assign to the created element
 * @returns {HTMLElement} The created HTML element
 */
const html = (selector, args = {}) => {
	let tag = "div"
	let tags = []
	if (typeof selector === "string") {
		tags = selector.split(".")
		tag = tags.shift() || "div"
	}
	if (typeof selector === "object") {
		args = selector
	}

	const element = document.createElement(tag)
	if (tags.length > 0) {
		element.classList.add(...tags)
	}

	// If args is an array of elements
	if (Array.isArray(args)) {
		addAll(element, args)
		return element	
	}

	// Deconstruct args and apply the args to the main element
	const { children, style, text, html, properties, ...other } = args
	Object.assign(element, other)
	if (text) element.textContent = text
	if (html) element.innerHTML = html
	if (style) Object.assign(element.style, style)
	if (children) {
		if (Array.isArray(children)) {
			addAll(element, children)
		} else {
			element.append(children)
		}
	}
	if (properties) {
		for (const property in properties) {
			const propertyValue = properties[property]
			if (propertyValue === undefined) continue
			element.style.setProperty(property, propertyValue)
		}
	}
	return element
}