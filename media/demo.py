import time
import pyautogui

def wait(ms):
    time.sleep(ms / 1000)

def click():
    pyautogui.click()

def simulate_typing(text, wait_after=250):
    pyautogui.write(text, interval=0.05)
    wait(wait_after)

def shortcut(keys, wait_after=250):
    pyautogui.press(keys)
    wait(wait_after)

def enter(wait_after=250):
    shortcut(['enter'], wait_after)

def tab(wait_after=250):
    shortcut(['tab'], wait_after)

def new_section(wait_after=250):
    enter(0)
    enter(wait_after)

wait(5000)
click()
wait(3500)
click()
wait(500)

simulate_typing('# Snippets plugin for Inkdrop')
new_section()

simulate_typing('Usage:')
enter()
simulate_typing('1. Type trigger')
enter()
simulate_typing('Press Tab')
enter()
simulate_typing('Magic!')
new_section()

simulate_typing('Static snippet:')
enter()
simulate_typing('hello')
tab()
new_section()

simulate_typing('Dynamic snippet:')
enter()
simulate_typing('date')
tab()
new_section()

simulate_typing('Placeholders:')
enter()
simulate_typing('name')
tab()
simulate_typing('Jane')
tab()
simulate_typing('Doe')

wait(2000)
click()
