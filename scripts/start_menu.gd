extends Node2D

func _on_button_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/shop.tscn")

func _process(_delta: float) -> void:
	if Input.is_action_just_pressed("use") || Input.is_action_just_pressed("use2"):
		get_tree().change_scene_to_file("res://scenes/shop.tscn")
