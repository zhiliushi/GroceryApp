"""Foodbank data pipeline FSM: scraped -> validated -> active."""

from app.fsm.engine import StateMachine, Transition

foodbank_pipeline = StateMachine(
    name="foodbank_pipeline",
    states=["scraped", "validated", "active", "inactive", "removed"],
    initial_state="scraped",
    transitions=[
        Transition("scraped", "validated", "validate",
                   description="Data verified by admin or automated check"),
        Transition("validated", "active", "activate",
                   description="Foodbank goes live on the platform"),
        Transition("active", "inactive", "deactivate",
                   description="Temporarily disable foodbank"),
        Transition("inactive", "active", "reactivate",
                   description="Re-enable foodbank"),
        Transition("active", "removed", "remove",
                   description="Permanently remove foodbank"),
        Transition("inactive", "removed", "remove",
                   description="Permanently remove inactive foodbank"),
    ],
)
