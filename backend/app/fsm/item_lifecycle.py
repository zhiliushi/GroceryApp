"""Item lifecycle FSM: scanned -> active -> consumed/expired/discarded."""

from app.fsm.engine import StateMachine, Transition

item_lifecycle = StateMachine(
    name="item_lifecycle",
    states=["scanned", "active", "consumed", "expired", "discarded"],
    initial_state="scanned",
    transitions=[
        Transition("scanned", "active", "promote",
                   description="User confirms item into inventory"),
        Transition("scanned", "scanned", "discard_scan",
                   description="User discards scan"),
        Transition("active", "consumed", "consume",
                   guard=lambda ctx: ctx.get("reason") == "used_up",
                   description="Item used up normally"),
        Transition("active", "expired", "expire",
                   description="Item reached expiry date"),
        Transition("active", "discarded", "discard",
                   guard=lambda ctx: ctx.get("reason") == "discarded",
                   description="User discards item"),
        Transition("consumed", "active", "restore",
                   description="Restore consumed item back to active"),
        Transition("expired", "active", "restore",
                   description="Restore expired item back to active"),
        Transition("discarded", "active", "restore",
                   description="Restore discarded item back to active"),
    ],
)
